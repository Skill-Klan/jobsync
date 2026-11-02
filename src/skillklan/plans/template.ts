import java from "./templates/java.json";
import javascript from "./templates/javascript.json";
import python from "./templates/python.json";
import manual from "./templates/manual.json";
import { PLAN_KINDS, type PlanKind } from "./kinds";

// A plan template is a tree in the same shape as the rows a student's copy is
// made of: module → topic → (group →) point, with a homework under a topic.
export { PLAN_KINDS, TICKABLE_KINDS, type PlanKind } from "./kinds";

export interface PlanNode {
  kind: PlanKind;
  title: string;
  materialUrl?: string;
  children?: PlanNode[];
}

export interface PlanTemplate {
  track: string;
  title: string;
  children: PlanNode[];
}

// Which kinds may sit directly under which. The depth is at most four levels.
const CHILDREN_OF: Record<PlanKind | "root", readonly PlanKind[]> = {
  root: ["module"],
  module: ["topic"],
  topic: ["group", "item", "homework", "homework_ref"],
  group: ["item"],
  homework: ["homework_task"],
  item: [],
  homework_task: [],
  homework_ref: [],
};

const TRACK = /^[a-z][a-z0-9-]*$/;

function fail(path: string, why: string): never {
  throw new Error(`Plan template: ${path}: ${why}`);
}

function checkNode(node: unknown, parent: PlanKind | "root", path: string): void {
  if (typeof node !== "object" || node === null) fail(path, "not an object");
  const { kind, title, materialUrl, children } = node as Record<string, unknown>;
  if (typeof kind !== "string" || !(PLAN_KINDS as readonly string[]).includes(kind)) fail(path, `unknown kind ${String(kind)}`);
  const k = kind as PlanKind;
  if (!CHILDREN_OF[parent].includes(k)) fail(path, `${k} cannot be under ${parent}`);
  if (typeof title !== "string" || title.trim() === "") fail(path, "empty title");
  if (materialUrl !== undefined) {
    if (k !== "topic") fail(path, "only a topic has a material link");
    if (typeof materialUrl !== "string" || !/^https?:\/\/\S+$/.test(materialUrl)) fail(path, "material link is not an http(s) URL");
  }
  const kids = children === undefined ? [] : children;
  if (!Array.isArray(kids)) fail(path, "children is not a list");
  if (CHILDREN_OF[k].length === 0 && kids.length > 0) fail(path, `${k} has no parts`);
  if (CHILDREN_OF[k].length > 0 && kids.length === 0) fail(path, `${k} is empty`);
  kids.forEach((child, i) => checkNode(child, k, `${path}/${i}`));
}

export function validatePlanTemplate(raw: unknown): PlanTemplate {
  if (typeof raw !== "object" || raw === null) fail("template", "not an object");
  const { track, title, children } = raw as Record<string, unknown>;
  if (typeof track !== "string" || !TRACK.test(track)) fail("track", "not a lowercase slug");
  if (typeof title !== "string" || title.trim() === "") fail("title", "empty");
  if (!Array.isArray(children) || children.length === 0) fail("children", "no modules");
  children.forEach((m, i) => checkNode(m, "root", `${track}/${i}`));
  return raw as PlanTemplate;
}

// Tracks are data: a new language is a new file here.
const TEMPLATES: Record<string, PlanTemplate> = {};
for (const raw of [java, javascript, python, manual]) {
  const template = validatePlanTemplate(raw);
  TEMPLATES[template.track] = template;
}

export const PLAN_TRACKS: readonly string[] = Object.keys(TEMPLATES);

export function getPlanTemplate(track: string): PlanTemplate | null {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, track) ? TEMPLATES[track] : null;
}
