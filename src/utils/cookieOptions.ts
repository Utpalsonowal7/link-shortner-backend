import type { CookieOptions } from "express";

const accessTokenOptions: CookieOptions = {
     httpOnly: true,
     secure: true,
     sameSite: "none",
     maxAge: 15 * 60 * 1000
};

const refreshTokenOptions: CookieOptions = {
     httpOnly: true,
     secure: true,
     sameSite: "none",
     maxAge: 30 * 24 * 60 * 60 * 1000
};

export { accessTokenOptions, refreshTokenOptions }
