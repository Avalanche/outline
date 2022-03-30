import debounce from "lodash/debounce";
import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { usePopoverState, PopoverDisclosure } from "reakit/Popover";
import styled, { useTheme } from "styled-components";
import Empty from "~/components/Empty";
import InputSearch from "~/components/InputSearch";
import Placeholder from "~/components/List/Placeholder";
import PaginatedList from "~/components/PaginatedList";
import Popover from "~/components/Popover";
import useStores from "~/hooks/useStores";
import SearchListItem from "./SearchListItem";

type Props = { shareId: string };

function SearchPopover({ shareId }: Props) {
  const { t } = useTranslation();
  const { documents } = useStores();
  const theme = useTheme();

  const popover = usePopoverState({
    placement: "bottom-start",
    unstable_offset: [-24, 0],
    modal: true,
  });

  const [query, setQuery] = React.useState("");
  const searchResults = documents.searchResults(query);

  // TODO: the debounce is not working correctly
  // it's at the wrong level -- needs to be in an effect
  // that updates the stuff that gets send into the component
  // right now, the params are sent into the paginated list
  // but the query is not executed until the debounce
  // creating a mismatch

  // in order to freeze the update until somerthing comes back
  // also do the same with searchResults (inside of use effect)
  const performSearch = React.useMemo(
    () =>
      debounce(async ({ query, ...options }: Record<string, any>) => {
        if (query?.length > 0) {
          console.log("DEBOUNCE", { options });
          return await documents.search(query, { shareId, ...options });
        }
        return undefined;
      }, 400),
    [documents, shareId]
  );

  const searchInputRef = popover.unstable_referenceRef;
  const firstSearchItem = React.useRef<HTMLAnchorElement>(null);

  const handleEscapeList = React.useCallback(
    () => searchInputRef?.current?.focus(),
    [searchInputRef]
  );

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "Enter") {
      if (searchResults?.length) {
        popover.show();
      }
    }

    if (ev.key === "ArrowDown" && !ev.shiftKey) {
      if (searchResults?.length) {
        if (ev.currentTarget.value.length === ev.currentTarget.selectionStart) {
          popover.show();
        }
        firstSearchItem.current?.focus();
      }
    }

    if (ev.key === "ArrowUp") {
      if (popover.visible) {
        popover.hide();
        ev.preventDefault();
      }

      if (ev.currentTarget.value) {
        if (ev.currentTarget.selectionEnd === 0) {
          ev.currentTarget.selectionStart = 0;
          ev.currentTarget.selectionEnd = ev.currentTarget.value.length;
          ev.preventDefault();
        }
      }
    }

    if (ev.key === "Escape") {
      if (popover.visible) {
        popover.hide();
        ev.preventDefault();
      }
    }
  };

  // TODO: scope the search by the shareId and not the user
  // TODO write tests for that

  // when showing, escape or up hides, when

  // TODO think about shrinking the context preview
  // TODO: keep old search results when changing the query — will require debounce + incrementer to tick the result set number
  // update search results on a tick, and only display when ticked up (call inside useEffect)

  // right now I'm making a closure but could shim it into a function with one object argument

  const handleSearch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;

    if (value.length) {
      popover.show();
      setQuery(event.target.value.trim());
    } else {
      popover.hide();
    }
  };

  // if the input has any stuff, then show the disclosure

  return (
    <>
      <PopoverDisclosure {...popover}>
        {(props) => {
          // props assumes the disclosure is a button, but we want a type-ahead
          // so we take the aria props, and ref and ignore the event handlers
          return (
            <InputSearch
              aria-controls={props["aria-controls"]}
              aria-expanded={props["aria-expanded"]}
              aria-haspopup={props["aria-haspopup"]}
              ref={props.ref}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
            />
          );
        }}
      </PopoverDisclosure>

      <Popover
        {...popover}
        aria-label={t("Results")}
        unstable_autoFocusOnShow={false}
        style={{ zIndex: theme.depths.sidebar + 1 }}
        shrink
      >
        <PaginatedList
          options={{ query }}
          items={searchResults}
          fetch={performSearch}
          onEscape={handleEscapeList}
          empty={
            <NoResults>{t("No results for {{query}}", { query })}</NoResults>
          }
          loading={<PlaceholderList count={3} header={{ height: 20 }} />}
          renderItem={(item, index, compositeProps) => (
            <SearchListItem
              key={item.document.id}
              shareId={shareId}
              ref={index === 0 ? firstSearchItem : undefined}
              document={item.document}
              context={item.context}
              highlight={query}
              onClick={popover.hide}
              {...compositeProps}
            />
          )}
        />
      </Popover>
    </>
  );
}

const NoResults = styled(Empty)`
  padding: 0 12px;
`;

const PlaceholderList = styled(Placeholder)`
  padding: 6px 12px;
`;

export default observer(SearchPopover);
