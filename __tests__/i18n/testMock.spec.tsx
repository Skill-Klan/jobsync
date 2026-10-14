// The test double of useTranslations behaves like the real hook in the one way
// components depend on: the same translator across renders (so `t` can sit in
// effect dependencies without re-running the effect forever).
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { useTranslations } from "@/i18n/client";

it("useTranslations returns the same translator on every render", () => {
  const seen: unknown[] = [];
  let runs = 0;
  function Probe({ n }: { n: number }) {
    const t = useTranslations("nav");
    seen.push(t);
    useEffect(() => {
      runs += 1;
    }, [t]);
    return <p>{n}</p>;
  }
  const { rerender } = render(<Probe n={1} />);
  rerender(<Probe n={2} />);
  rerender(<Probe n={3} />);
  expect(new Set(seen).size).toBe(1);
  expect(runs).toBe(1);
});
