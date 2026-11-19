/* Registration page — POST /api/v1/auth/register (endpoint 5). */

import { register, login } from "../auth.js";
import { errorMessage, formValues, qs, setAlert, setFieldError, busy } from "../ui.js";

const form = qs("#register-form");
const submit = qs("#register-submit");
const alertBox = qs("#register-alert");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert(alertBox, "", "");
  const values = formValues(form);
  let valid = true;
  ["full_name", "email", "password"].forEach((name) => {
    const message = values[name] ? "" : "This field is required.";
    setFieldError(form.elements[name], message);
    if (message) valid = false;
  });
  if (!valid) {
    setAlert(alertBox, "error", "Complete the required fields before submitting.");
    return;
  }

  const payload = {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    password: values.password
  };
  ["phone", "location", "county"].forEach((key) => {
    if (values[key] && values[key].trim()) payload[key] = values[key].trim();
  });

  busy(submit, true, "Create account");
  try {
    await register(payload);
    await login({ email: payload.email, password: payload.password });
    location.href = "profile.html";
  } catch (error) {
    setAlert(alertBox, "error", errorMessage(error));
    busy(submit, false);
  }
});
