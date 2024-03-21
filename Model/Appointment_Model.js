class AppointmentModel {
  constructor(
    hospital,
    type,
    fee,
    doctorId,
    doctorName,
    department,
    complain,
    slot,
    date,
    patientId,
    slotId,
    patientName,
    profileImage
  ) {
    this.hospital = hospital;
    this.type = type;
    this.fee = fee;
    this.doctorId = doctorId;
    this.doctorName = doctorName;
    this.department = department;
    this.complain = complain;
    this.slot = slot;
    this.date = date;
    this.patientId = patientId;
    this.slotId = slotId;
    this.patientName = patientName;
    this.profileImage = profileImage;
  }
}

export default AppointmentModel;
