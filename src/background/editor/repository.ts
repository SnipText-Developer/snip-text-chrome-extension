import { vendors } from "../../config/vendors";
import type { EditorStatus } from "../../core/data-types";
import type { EditorVendorName } from "../../core/data-types";

const LIST_MAX_LEN = 2;

const storage: Partial<Record<`snip.${EditorVendorName}`, EditorStatus>> = Object.fromEntries(
  vendors.map(({ id }) => [`snip.${id}`, {
    isEditable: false, text: "", prevTexts: [], vendorName: id,
  }]),
);

const getKey = (vendorName: EditorVendorName): `snip.${EditorVendorName}` =>
  `snip.${vendorName}`;

const read = async (
  vendorName: EditorVendorName,
): Promise<EditorStatus | null> => {
  const key = getKey(vendorName);
  return storage[key] ? { ...storage[key] } : null;
};

const create = async (
  vendorName: EditorVendorName,
  data: EditorStatus,
): Promise<EditorStatus | null> => {
  const key = getKey(vendorName);
  storage[key] = { ...storage[key], ...data };

  return await read(vendorName);
};

const readAll = async (): Promise<EditorStatus[]> => {
  return Object.values(storage);
};

const readLen = async (): Promise<number> => {
  return Object.keys(storage).length;
};

const update = async (
  vendorName: EditorVendorName,
  data: Partial<EditorStatus>,
): Promise<EditorStatus | null> => {
  const key = getKey(vendorName);
  if (!storage[key]) {
    return null;
  }

  const updated: EditorStatus = {
    ...storage[key],
    ...data,
  };
  if (updated.prevTexts.length > LIST_MAX_LEN) {
    updated.prevTexts.slice(LIST_MAX_LEN);
  }

  storage[key] = updated;

  return await read(vendorName);
};

const appendPrevTexts = async (
  vendorName: EditorVendorName,
  prevText: string,
): Promise<EditorStatus | null> => {
  const key = getKey(vendorName);
  const status = storage[key];
  if (!status) return null;

  status.prevTexts.unshift(prevText);
  if (status.prevTexts.length > LIST_MAX_LEN) {
    status.prevTexts.pop();
  }

  return await read(vendorName);
};

const deleteOne = async (
  vendorName: EditorVendorName,
): Promise<EditorStatus | null> => {
  const key = getKey(vendorName);
  if (!storage[key]) {
    return null;
  }

  const deleted = { ...storage[key] };
  delete storage[key];

  return deleted;
};

export const repository = {
  create,
  readAll,
  readLen,
  read,
  update,
  appendPrevTexts,
  deleteOne,
};
