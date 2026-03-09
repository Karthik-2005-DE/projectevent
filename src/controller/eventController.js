import Event from "../models/Event.js";

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseOptionalNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw createValidationError(`${label} must be a valid number.`);
  }

  return parsedValue;
}

function parseOptionalWholeNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw createValidationError(`${label} must be a non-negative whole number.`);
  }

  return parsedValue;
}

function setTrimmedString(payload, key, value, options = {}) {
  if (typeof value !== "string") {
    return;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    if (options.allowEmpty) {
      payload[key] = "";
    }

    return;
  }

  payload[key] = options.lowercase ? normalizedValue.toLowerCase() : normalizedValue;
}

function buildEventPayload(req, existingEvent = null) {
  const payload = {};

  setTrimmedString(payload, "title", req.body.title);
  setTrimmedString(payload, "location", req.body.location);
  setTrimmedString(payload, "description", req.body.description, { allowEmpty: true });
  setTrimmedString(payload, "category", req.body.category, { lowercase: true, allowEmpty: true });

  if (req.body.date) {
    payload.date = req.body.date;
  }

  const price = parseOptionalNumber(req.body.price, "Price");
  if (price !== null) {
    if (price < 0) {
      throw createValidationError("Price must be zero or more.");
    }

    payload.price = price;
  }

  const totalTickets = parseOptionalWholeNumber(req.body.totalTickets, "Total tickets");
  const availableTickets = parseOptionalWholeNumber(
    req.body.availableTickets,
    "Available tickets"
  );

  if (totalTickets !== null) {
    payload.totalTickets = totalTickets;
  }

  if (availableTickets !== null) {
    payload.availableTickets = availableTickets;
  }

  if (req.file) {
    payload.image = req.file.filename;
  } else if (req.body.removeImage === "true") {
    payload.image = "";
  } else {
    setTrimmedString(payload, "image", req.body.imageUrl ?? req.body.image, { allowEmpty: true });
  }

  if (!existingEvent && payload.totalTickets !== undefined && payload.availableTickets === undefined) {
    payload.availableTickets = payload.totalTickets;
  }

  if (existingEvent && payload.totalTickets !== undefined && payload.availableTickets === undefined) {
    const currentTotal = Number(existingEvent.totalTickets ?? 0);
    const currentAvailable = Number(existingEvent.availableTickets ?? 0);
    const soldTickets = Math.max(0, currentTotal - currentAvailable);

    if (payload.totalTickets < soldTickets) {
      throw createValidationError("Total tickets cannot be less than tickets already sold.");
    }

    payload.availableTickets = payload.totalTickets - soldTickets;
  }

  const nextTotal =
    payload.totalTickets !== undefined
      ? payload.totalTickets
      : Number(existingEvent?.totalTickets ?? payload.totalTickets ?? 0);
  const nextAvailable =
    payload.availableTickets !== undefined
      ? payload.availableTickets
      : Number(existingEvent?.availableTickets ?? payload.availableTickets ?? 0);

  if (nextAvailable > nextTotal) {
    throw createValidationError("Available tickets cannot exceed total tickets.");
  }

  return payload;
}

function resolveEventErrorStatus(error) {
  if (error?.statusCode) {
    return error.statusCode;
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return 400;
  }

  return 500;
}

export const createEvent = async (req, res) => {
  try {
    const event = await Event.create(buildEventPayload(req));
    res.status(201).json(event);
  } catch (error) {
    res
      .status(resolveEventErrorStatus(error))
      .json({ message: "Error creating event", error: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1, createdAt: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Error fetching events" });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    res.status(500).json({ message: "Error fetching event" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const existingEvent = await Event.findById(req.params.id);

    if (!existingEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    const updatePayload = buildEventPayload(req, existingEvent);

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    res.json(event);
  } catch (error) {
    res
      .status(resolveEventErrorStatus(error))
      .json({ message: "Error updating event", error: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting event" });
  }
};
