import {
  getDocs,
  addDoc,
  collection,
  query,
  where,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../Config/config.js";
import AppointmentModel from "../Model/Appointment_Model.js";
import nodemailer from "nodemailer";
import axios from "axios";

const postAppointmentToFirebase = async (req, res) => {
  try {
    // Extract appointment data from req.body
    const {
      hospital,
      type,
      doctorId,
      doctorName,
      department,
      patientId,
      slot,
      date,
      fee,
      complain,
      slotId,
      patientName,
      profileImage,
      email,
      meetingLink, // Added meetingLink field for online appointments
    } = req.body;
    console.log(req.body);

    // Set default value for meetingLink
    const defaultMeetingLink = type === "Online" ? meetingLink : "N/A";

    // Construct appointment object
    const appointmentData = {
      hospital: type === "Physical" ? hospital : "N/A",
      meetingLink: defaultMeetingLink,
      type,
      doctorId,
      doctorName,
      department,
      patientId,
      slot,
      date,
      fee,
      complain,
      slotId,
      patientName,
      profileImage,
      email,
    };

    // Add appointment data to Firestore
    const appointmentsRef = collection(db, "appointment");
    const docRef = await addDoc(appointmentsRef, appointmentData);

    // Send success response
    res.status(201).json({
      message: "Appointment created successfully",
      id: docRef.id,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating appointment" });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.query.doctorId; // Access doctorId from query parameters

    // Check if doctorId is defined
    if (!doctorId) {
      return res.status(400).json({ error: "Doctor ID is required" });
    }

    const appointmentsRef = collection(db, "appointment");
    const q = query(appointmentsRef, where("doctorId", "==", doctorId));
    const querySnapshot = await getDocs(q);
    const appointments = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const rawDate = data.date;
      const dateObject = rawDate ? new Date(rawDate.replace(" ", "T")) : null;

      // Determine whether to use hospital or meetingLink based on appointment type
      const location =
        data.type === "Physical" ? data.hospital : data.meetingLink;

      const appointment = new AppointmentModel(
        location,
        data.type,
        data.fee,
        data.doctorId,
        data.doctorName,
        data.department,
        data.complain,
        data.slot,
        dateObject,
        data.patientId,
        data.slotId,
        data.patientName,
        data.profileImage
      );
      appointments.push({ ...appointment, id: doc.id });
    });
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching appointments" });
  }
};

const getPatientAppointments = async (req, res) => {
  try {
    console.log(req.body);
    // Extract patientId from req.body
    const { patientId } = req.body;

    // Check if patientId is provided
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    // Query appointments collection by patientId
    const appointmentsRef = collection(db, "appointment");
    const q = query(appointmentsRef, where("patientId", "==", patientId));
    const querySnapshot = await getDocs(q);

    // Extract appointment data from query snapshot
    const appointments = [];
    querySnapshot.forEach((doc) => {
      appointments.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Send success response with appointment data
    res.status(200).json({ appointments });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching appointments" });
  }
};

const rescheduleAppointment = async (req, res) => {
  try {
    const { selectedAppointmentId } = req.params;
    const { newDate, newSlotId } = req.body;

    console.log("Selected Appointment ID:", selectedAppointmentId);
    console.log("New Date:", newDate);
    console.log("New Slot ID:", newSlotId);

    // Fetch appointment by id
    const appointmentRef = doc(db, "appointment", selectedAppointmentId);

    const appointmentDoc = await getDoc(appointmentRef);

    if (!appointmentDoc.exists()) {
      console.log("Appointment not found.");
      return res.status(404).json({ error: "Appointment not found" });
    }

    const appointmentData = appointmentDoc.data();
    console.log("Appointment Data:", appointmentData);

    // Extract necessary fields from the appointment document
    const { doctorId, slotId } = appointmentData;
    console.log("Doctor ID:", doctorId);
    console.log("Slot ID:", slotId);

    // Fetch the weekStartDate using the doctorId for the existing slot
    const oldSlotWeekStartDate = await getWeekStartDateByDoctorIdAndSlotId(
      doctorId,
      slotId
    );
    console.log("Old Slot Week Start Date:", oldSlotWeekStartDate);

    if (!oldSlotWeekStartDate) {
      console.log("Week start date not found for old slot.");
      return res
        .status(404)
        .json({ error: "Week start date not found for old slot" });
    }

    // Fetch the weekStartDate using the doctorId for the new slot
    const newSlotWeekStartDate = await getWeekStartDateByDoctorIdAndSlotId(
      doctorId,
      newSlotId
    );
    console.log("New Slot Week Start Date:", newSlotWeekStartDate);

    if (!newSlotWeekStartDate) {
      console.log("Week start date not found for new slot.");
      return res
        .status(404)
        .json({ error: "Week start date not found for new slot" });
    }

    // Update availability of old and new slots
    console.log("Updating slot availability for old slot...");
    await updateSlotAvailability(
      slotId,
      "Available",
      doctorId,
      oldSlotWeekStartDate
    );
    console.log("Slot availability updated for old slot.");

    console.log("Updating slot availability for new slot...");
    await updateSlotAvailability(
      newSlotId,
      "Booked",
      doctorId,
      newSlotWeekStartDate
    );
    console.log("Slot availability updated for new slot.");

    // Fetch details of the new slot from the slots database
    console.log("Fetching new slot details...");
    const newSlotDetails = await getSlotDetails(
      doctorId,
      newSlotWeekStartDate,
      newSlotId
    );

    console.log("New Slot Details:", newSlotDetails);

    // Update appointment with new date, slotId, hospital, fee, and type
    console.log("Updating appointment document...");
    await updateDoc(appointmentRef, {
      slot: newSlotDetails.detailedSlot.startTime,
      date: newDate,
      slotId: newSlotId,
      hospital: newSlotDetails.detailedSlot.hospital,
      fee: newSlotDetails.detailedSlot.price,
      type: newSlotDetails.detailedSlot.slotType,
    });
    console.log("Appointment document updated.");

    const patientEmail = appointmentData.email;
    const subject = "Appointment Reschedule Notice";
    const message = `Dear Mr/Ms. ${appointmentData.patientName} Your appointment has been rescheduled. New Date: ${newDate}, New Slot: ${newSlotDetails.detailedSlot.startTime}`;
    await sendEmail(patientEmail, subject, message);

    res.status(200).json({ message: "Appointment rescheduled successfully" });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Function to send email
const sendEmail = async (to, subject, message) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "wecareemrsystem345@gmail.com", // Your email address
        pass: "vuxi enzs yzvv johu", // Your email password
      },
    });

    // Email options
    const mailOptions = {
      from: "wecareemrsystem345@gmail.com", // Sender email
      to: to, // Recipient email
      subject: subject,
      text: message,
    };

    // Send email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// Function to get the weekStartDate by doctorId
const getWeekStartDateByDoctorIdAndSlotId = async (doctorId, slotId) => {
  try {
    const response = await axios.get(
      `http://localhost:5001/api/slots/getDateByID/${doctorId}/${slotId}`
    );
    if (response.status === 200) {
      return response.data.weekStartDate;
    } else {
      throw new Error("Failed to fetch weekStartDate");
    }
  } catch (error) {
    console.error("Error fetching weekStartDate:", error);
    throw error;
  }
};

// Function to update slot availability with weekStartDate
const updateSlotAvailability = async (
  slotUuid,
  newStatus,
  uniqueIdentifier,
  weekStartDate
) => {
  try {
    await axios.post("http://localhost:5001/api/slots/updateAvailibility", {
      uniqueIdentifier,
      slotUuid,
      newStatus,
      weekStartDate, // Pass weekStartDate to update slot availability
    });
  } catch (error) {
    console.error("Error updating slot availability:", error);
    throw error;
  }
};

const getSlotDetails = async (uniqueIdentifier, weekStartDate, slotId) => {
  try {
    const response = await axios.get(
      `http://localhost:5001/api/slots/getSlotByID/${uniqueIdentifier}/${weekStartDate}/${slotId}`
    );

    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error("Failed to fetch slot details");
    }
  } catch (error) {
    console.error("Error fetching slot details:", error);
    throw error;
  }
};

// Function to cancel appointment
const cancelAppointment = async (req, res) => {
  try {
    const { selectedAppointmentId } = req.params;
    const appointmentRef = doc(db, "appointment", selectedAppointmentId);
    const appointmentDoc = await getDoc(appointmentRef);

    if (!appointmentDoc.exists()) {
      console.log("Appointment not found.");
      return res.status(404).json({ error: "Appointment not found" });
    }

    const appointmentData = appointmentDoc.data();

    await deleteDoc(appointmentRef); // Delete the appointment

    // Add the canceled appointment to the canceled appointments collection
    const canceledAppointmentsRef = collection(db, "canceled_appointments");
    await addDoc(canceledAppointmentsRef, appointmentData);

    // Send email to patient about canceled appointment
    const patientEmail = appointmentData.email;
    const subject = "Appointment Cancellation Notice";
    const message = `Dear Mr/Ms. ${appointmentData.patientName} Your appointment has been canceled due to unforseen circumstances. We apologize for the inconvinience. `;
    await sendEmail(patientEmail, subject, message);

    res.status(200).json({ message: "Appointment canceled successfully" });
  } catch (error) {
    console.error("Error canceling appointment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export {
  getDoctorAppointments,
  postAppointmentToFirebase,
  getPatientAppointments,
  rescheduleAppointment,
  cancelAppointment,
};
