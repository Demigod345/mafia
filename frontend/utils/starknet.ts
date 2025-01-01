// @ts-nocheck

import { shortString } from "starknet";

export function twoFeltToString(x, y) {
    const str1 = shortString.decodeShortString(x);
    const str2 = shortString.decodeShortString(y);
  return str1 + str2;
}

export function stringToTwoFelt(str) {
    const arrStr = shortString.splitLongString(str);
    const x = shortString.encodeShortString(arrStr[0]);
    const y = shortString.encodeShortString(arrStr[1]);
  return { x, y };
}
