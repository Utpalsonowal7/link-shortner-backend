import { client } from "../../lib/redis.js";
import { ApiError } from "../../utils/api_error.js";
import { generateUniqueShortCode } from "../link/uniqueCode.js";

const storeTempUrl = async (link, code) => {
     const shortCode = code || (await generateUniqueShortCode());

     await client.setex(shortCode, 300, link);
     const shortUrl = `${process.env.BACK_END_URL?.replace(/\/$/, "")}/temp/${shortCode}`;

     return shortUrl;
};

const getAndRedirect = async (shortCode) => {
     const res = await client.get(shortCode);

     return res;
};

export default {
     TempUrlService: storeTempUrl,
     TempredirectService: getAndRedirect,
};
