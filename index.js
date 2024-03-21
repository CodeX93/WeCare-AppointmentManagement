import express from "express";
import cors from "cors";
import appointmentRoute from "./Route/Appointment_Route.js";

const app = express();
const PORT = process.env.PORT || 3009;

app.use(express.json({ extended: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.urlencoded({ extended: false }));

app.use("/appointment", appointmentRoute);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
