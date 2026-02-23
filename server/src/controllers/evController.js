import axios from "axios";



export const getEVStations = async (req, res) => {

  try {
    const { lat, lng } = req.query;
    const response = await axios.get(
      "https://api.openchargemap.io/v3/poi/",
      {
        params: {
          output: "json",
          latitude: lat,
          longitude: lng,
          distance: 200, // 🔥 200 km radius
          maxresults: 100,
          key: process.env.OPENCHARGE_API_KEY,
        },
      }
    );

    // 🔥 IMPORTANT TRANSFORMATION
    const stations = response.data.map((item) => ({
      name: item.AddressInfo?.Title,
      lat: item.AddressInfo?.Latitude,
      lng: item.AddressInfo?.Longitude,
    }));

    res.json(stations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching EV stations" });
  }
};