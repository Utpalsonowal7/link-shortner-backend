import { IpGeolocationClient } from "ip-geolocation-api-javascript-sdk";

const client = new IpGeolocationClient({
     apiKey: process.env.GEO_IP_API_KEY,
});

export const getClientGeoInfo = async (ip) => {
     try {
          const geoData = await client.lookupIpGeolocation({ip: ip});

          return {
               continent: geoData.data.location.continentName,
               country: geoData.data.location.countryName,
               region: geoData.data.location.stateProv,
               city: geoData.data.location.city,
               district: geoData.data.location.district,
          };
     } catch (err) {
          console.error("Geo lookup failed:", err.message);
          return {
               continent: null,
               country: null,
               region: null,
               city: null,
               district: null,
          };
     }
};
