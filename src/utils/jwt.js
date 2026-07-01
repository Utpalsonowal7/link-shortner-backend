import jwt from "jsonwebtoken";

const generateAccessToken = (payload) => {
     return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
     });
}

const generateRefreshToken = (payload) => {
     return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
          expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
     });
}

export { generateAccessToken, generateRefreshToken };