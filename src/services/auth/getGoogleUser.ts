import type { GoogleUserResponse } from "../../types/index.js";
import axios from "axios";

export const googleUser = async (access_token: string) => {
     const userData = await axios.get<GoogleUserResponse>(`${process.env.GOOGLE_PROVIDER_URI}`, {
          headers: { Authorization: `Bearer ${access_token}` }
     });

     return userData.data
};
