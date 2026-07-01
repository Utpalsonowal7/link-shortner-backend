import axios from "axios";

export const googleUser = async (access_token) => {
     const userData = await axios.get(`${process.env.GOOGLE_PROVIDER_URI}`, {
          headers: { Authorization: `Bearer ${access_token}` }
     });

     return userData.data
};