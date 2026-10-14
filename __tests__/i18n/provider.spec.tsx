// The real wiring, without the test mocks: IntlClientProvider + the hooks from
// "@/i18n/client" render the dictionary of the given locale, and a key missing
// there shows the English text instead of a raw key.
vi.unmock("@/i18n/client");

import { render, screen } from "@testing-library/react";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { useTranslations } from "@/i18n/client";
import { MESSAGES } from "@/i18n/messages";

function Probe() {
  const t = useTranslations("nav");
  return <p>{t("jobs")}</p>;
}

describe("IntlClientProvider", () => {
  it("renders the Ukrainian dictionary", () => {
    render(<IntlClientProvider locale="uk" messages={MESSAGES.uk}><Probe /></IntlClientProvider>);
    expect(screen.getByText("Вакансії")).toBeInTheDocument();
  });

  it("renders the English dictionary", () => {
    render(<IntlClientProvider locale="en" messages={MESSAGES.en}><Probe /></IntlClientProvider>);
    expect(screen.getByText("Jobs")).toBeInTheDocument();
  });

  it("a key missing in Ukrainian falls back to English, not to 'nav.jobs'", () => {
    const { jobs: _dropped, ...navWithoutJobs } = MESSAGES.uk.nav;
    const broken = { ...MESSAGES.uk, nav: navWithoutJobs } as unknown as typeof MESSAGES.uk;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<IntlClientProvider locale="uk" messages={broken}><Probe /></IntlClientProvider>);
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.queryByText("nav.jobs")).toBeNull();
    spy.mockRestore();
  });
});
