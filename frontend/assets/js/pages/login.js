/* Login page — POST /api/v1/auth/login (endpoint 6). */

import { login } from "../auth.js";
import { errorMessage, formValues, qs, setAlert, setFieldError, busy } from "../ui.js";

const form = qs("#login-form");
const submit = qs("#login-submit");
const alertBox = qs("#login-alert");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setAlert(alertBox, "", "");
  const values = formValues(form);
  let valid = true;
  ["email", "password"].forEach((name) => {
    const message = values[name] ? "" : "This field is required.";
    setFieldError(form.elements[name], message);
    if (message) valid = false;
  });
  if (!valid) {
    setAlert(alertBox, "error", "Enter both your email and password.");
    return;
  }

  busy(submit, true, "Sign in");
  try {
    await login({ email: values.email.trim(), password: values.password });
    const params = new URLSearchParams(location.search);
    location.href = params.get("next") || "index.html";
  } catch (error) {
    setAlert(alertBox, "error", errorMessage(error));
    busy(submit, false);
  }
});
