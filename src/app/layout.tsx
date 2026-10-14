import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { IntlClientProvider } from "@/i18n/IntlClientProvider";
import { MESSAGES } from "@/i18n/messages";
import { getLocale, getTranslations } from "@/i18n/server";

export const dynamic = "force-dynamic";

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: {
      template: "%s | SkillKlan Job",
      default: "SkillKlan Job",
    },
    description: t("appDescription"),
  };
}

interface Props {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: Readonly<Props>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <IntlClientProvider locale={locale} messages={MESSAGES[locale]}>
            {children}
            <Toaster />
          </IntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
