// Dashboard quick actions. A label wraps onto a second line instead of being
// cut with an ellipsis — Ukrainian labels are long ("Додати активність") and
// the card can be narrow; the button grows to fit it. A single word can't wrap,
// so two columns start at a 20rem card and use px-3 (not the default px-4,
// which cuts "Automation" at a 1250px window). Measured: the longest word has
// 6px to spare at the narrowest two-column card, 11px at 1280px. A narrower
// card — a tablet's three-column dashboard — stacks the buttons in one column.
// items-stretch: CardFooter centres its items, which would leave a one-line
// button shorter than the two-line one beside it.
export const QUICK_ACTIONS_GRID = "mt-auto grid grid-cols-1 @min-[20rem]:grid-cols-2 items-stretch gap-2";
export const QUICK_ACTION_BUTTON = "h-auto min-h-10 px-3 justify-start whitespace-normal text-left min-w-0";
export const QUICK_ACTION_LABEL = "min-w-0 leading-snug";
