import { vendors } from "../../config/vendors";
import type { EditorStatus, EditorVendorName } from "../../core/data-types";
import { sessionStorage } from "../common/storage";

const STORAGE_KEY = "snip.editors";
const LIST_MAX_LEN = 2;
type EditorStates = Partial<Record<EditorVendorName, EditorStatus>>;

// Serialize read-modify-write operations on the shared editor record.
let pending: Promise<unknown> = Promise.resolve();

function mutate<T>(operation: (states: EditorStates) => Promise<T>): Promise<T> {
  const result = pending.then(async () => operation(await load()));
  pending = result.catch(() => {});
  return result;
}

async function load(): Promise<EditorStates> {
  return (await sessionStorage.get<EditorStates>(STORAGE_KEY)) ?? Object.fromEntries(
    vendors.map(({ id }) => [id, {
      isEditable: false, text: "", prevTexts: [], vendorName: id,
    }]),
  );
}

async function save(
  states: EditorStates,
  vendorName: EditorVendorName,
  status: EditorStatus,
): Promise<EditorStatus> {
  states[vendorName] = status;
  await sessionStorage.set(STORAGE_KEY, states);
  return status;
}

const read = async (vendorName: EditorVendorName): Promise<EditorStatus | null> =>
  (await load())[vendorName] ?? null;

const create = (
  vendorName: EditorVendorName,
  data: EditorStatus,
): Promise<EditorStatus> =>
  mutate((states) => save(states, vendorName, { ...states[vendorName], ...data }));

const readAll = async (): Promise<EditorStatus[]> => Object.values(await load());

const readLen = async (): Promise<number> => Object.keys(await load()).length;

const update = (
  vendorName: EditorVendorName,
  data: Partial<EditorStatus>,
  prevText?: string,
): Promise<EditorStatus | null> =>
  mutate(async (states) => {
    const status = states[vendorName];
    if (!status) return null;

    const updated = { ...status, ...data };
    if (prevText !== undefined) {
      updated.prevTexts.unshift(prevText);
      if (updated.prevTexts.length > LIST_MAX_LEN) updated.prevTexts.pop();
    }

    return save(states, vendorName, updated);
  });

const appendPrevTexts = (
  vendorName: EditorVendorName,
  prevText: string,
): Promise<EditorStatus | null> => update(vendorName, {}, prevText);

const deleteOne = (vendorName: EditorVendorName): Promise<EditorStatus | null> =>
  mutate(async (states) => {
    const status = states[vendorName];
    if (!status) return null;

    delete states[vendorName];
    await sessionStorage.set(STORAGE_KEY, states);
    return status;
  });

export const repository = {
  create,
  readAll,
  readLen,
  read,
  update,
  appendPrevTexts,
  deleteOne,
};
