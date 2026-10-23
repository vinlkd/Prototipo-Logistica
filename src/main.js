if (import.meta.env.MODE === "pages") {
  await import("./simulator/app.js");
} else {
  await import("./auth.js");
}
