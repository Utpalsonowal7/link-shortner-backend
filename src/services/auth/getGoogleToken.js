import axios from "axios";

export const getGoogleToken = async (code) => {
     const data = await axios.post(`${process.env.GOOGLE_TOKEN_URI}`, {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code'
     });

     return data.data
};