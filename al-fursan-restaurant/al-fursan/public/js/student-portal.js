const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector("#main-nav");
const loginDialog = document.querySelector("#login-dialog");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const toast = document.querySelector("#toast");
let toastTimer;

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  mainNav.classList.toggle("open", !isOpen);
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  });
});

document.querySelectorAll("[data-open-login]").forEach((button) => {
  button.addEventListener("click", () => {
    loginMessage.textContent = "";
    loginDialog.showModal();
  });
});

document.querySelector("[data-close-login]").addEventListener("click", () => loginDialog.close());

loginDialog.addEventListener("click", (event) => {
  if (event.target === loginDialog) loginDialog.close();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginMessage.textContent = "Thanks! Connect your school sign-in service to continue.";
});

const courseSearch = document.querySelector("#course-search");
const courseRows = [...document.querySelectorAll(".course-row")];
const emptyCourses = document.querySelector("#empty-courses");

courseSearch.addEventListener("input", () => {
  const query = courseSearch.value.trim().toLowerCase();
  let visibleCount = 0;

  courseRows.forEach((row) => {
    const matches = row.dataset.course.includes(query);
    row.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  emptyCourses.hidden = visibleCount > 0;
});

document.querySelectorAll(".course-row").forEach((row) => {
  row.addEventListener("click", (event) => {
    event.preventDefault();
    loginMessage.textContent = "";
    loginDialog.showModal();
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target || target !== document.querySelector("#login")) return;
    event.preventDefault();
    loginMessage.textContent = "";
    loginDialog.showModal();
  });
});
