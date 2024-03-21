import express from "express";

import {
  getDoctorAppointments,
  postAppointmentToFirebase,
  getPatientAppointments,
  rescheduleAppointment,
  cancelAppointment,
} from "../Controller/AppointmentController.js";

const appointmentRoute = express.Router();

appointmentRoute.post("/makeappointment", postAppointmentToFirebase);
appointmentRoute.get("/allappointment", getDoctorAppointments);
appointmentRoute.post("/allpappointment", getPatientAppointments);
appointmentRoute.patch(
  "/reschedule/:selectedAppointmentId",
  rescheduleAppointment
);
appointmentRoute.delete("/cancel/:selectedAppointmentId", cancelAppointment);

// appointmentRoute.get("/:id", getAppointmentsByDoctor);
// appointmentRoute.get("/patient/:id", getAppointmentsByPatient);
// appointmentRoute.put("/update/:id", updateAppointment);
// appointmentRoute.delete("/delete/:id", deleteAppointment);

export default appointmentRoute;
