"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import packageJson from "../../package.json";

const BRAND = "SkillKlan Job";
const BRAND_URL = "https://jobs.skillklan.com.ua";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// skillklan: no upstream links, star prompt or update check — this app is developed
// independently. The JobSync attribution stays: it is a condition of the MIT license.
export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const appVersion = packageJson.version;
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Support</DialogTitle>
          <DialogDescription>
            {BRAND} — job search tracker for SkillKlan students and graduates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Version</h3>
            <p className="text-sm text-muted-foreground">v{appVersion}</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Copyright</h3>
            <p className="text-sm text-muted-foreground">
              © {currentYear} {BRAND}. Based on JobSync by gsync, MIT License.
            </p>
            <a
              href={BRAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {BRAND}
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
