const express = require("express");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const password = "purple-monkey-dinosaur"; // found in the req.body object
const hashedPassword = bcrypt.hashSync(password, 10);
const app = express();
const PORT = 8080;

const {
  generateRandomString,
  hasUser,
  getUserByEmail,
  urlsForUser,
} = require("./helpers");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};
const users = {};

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["Test"],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  })
);

// Homepage
app.get("/urls", (req, res) => {
  const templateVars = {
    user: users[req.session.user_id],
    urls: urlsForUser(req.session.user_id, urlDatabase),
  };
  res.render("urls_index", templateVars);
});

// Creating new urls
app.get("/urls/new", (req, res) => {
  // If the user is not logged in, redirect to /login
  if (!req.session.user_id) {
    return res.redirect("/login");
  }
  const templateVars = {
    user: users[req.session.user_id]
  };
  res.render("urls_new", templateVars);
});

app.post("/urls", (req, res) => {
  if (hasUser(req.session.user_id, users)) {
    let shortURL = generateRandomString();
    urlDatabase[shortURL] = {
      longURL: req.body.longURL,
      userID: req.session.user_id,
    };
    res.redirect(`/urls/${shortURL}`);
  } else {
    return res.status(401).send("Please log in to shorten URLs.");
  }
});

app.get("/urls/:id", (req, res) => {
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];

  if (!url) {
    return res.status(404).send("<h1>URL not found</h1>");
  }

  const userId = req.session.user_id;

  if (!userId) {
    return res.status(401).send("<h1>Please log in to view this page.</h1>");
  }

  if (url.userID !== userId) {
    return res.status(403).send("<h1>You do not have permission to view this page.</h1>");
  }

  const templateVars = {
    id: shortURL,
    longURL: url.longURL,
    user: users[userId]
  };
  res.render("urls_show", templateVars);
});

app.post("/urls/:id/update", (req, res) => {
  const shortURL = req.params.id;
  const newLongURL = req.body.longURL;
  
  const userId = req.session.user_id;

  if (!userId) {
    return res.status(401).send("<h1>Please log in to edit this URL.</h1>");
  }

  const url = urlDatabase[shortURL];

  if (!url) {
    return res.status(404).send("<h1>URL not found.</h1>");
  }

  if (url.userID !== userId) {
    return res.status(403).send("<h1>You do not have permission to edit this URL.</h1>");
  }

  urlDatabase[shortURL].longURL = newLongURL;
  res.redirect(`/urls`);
});

app.post("/urls/:id/delete", (req, res) => {
  const shortURL = req.params.id;
  
  const userId = req.session.user_id;

  if (!userId) {
    return res.status(401).send("<h1>Please log in to delete this URL.</h1>");
  }

  const url = urlDatabase[shortURL];

  if (!url) {
    return res.status(404).send("<h1>URL not found.</h1>");
  }

  if (url.userID !== userId) {
    return res.status(403).send("<h1>You do not have permission to delete this URL.</h1>");
  }

  delete urlDatabase[shortURL];
  res.redirect("/urls");
});

app.get("/u/:id", (req, res) => {
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];
  
  // Check if the shortURL exists in the database
  if (!url) {
    // Respond with an HTML error message
    return res.status(404).send("<h1>Error: The short URL does not exist!</h1>");
  }
  // Redirect to the long URL
  let longURL = url.longURL;
  if (!longURL.includes ('http')) {
    longURL = 'http://' + url.longURL
  }
  res.redirect(longURL);
});

// Registration Page
app.get("/register", (req, res) => {
  const templateVars = {
    user: users[req.session.user_id],
    urls: urlDatabase
  };
  res.render("urls_register", templateVars);
});

// Creating a new user
app.post("/register", (req, res) => {
  const email = req.body.email;
  const password = bcrypt.hashSync(req.body.password, 10);
  if (!email || !password) {
    res.status(400).send("Please provide both a valid email and password");
  } else if (hasUser(email, users)) {
    res.status(400).send("This account already exists");
  } else {
    const id = generateRandomString();
    users[id] = {
      id,
      email,
      password
    };
    req.session.user_id = id;
    res.redirect("/urls");
  }
});

// Login
app.get("/login", (req, res) => {
  const templateVars = {
    user: users[req.session.user_id],
    urls: urlDatabase
  };
  res.render("urls_login", templateVars);
});

app.post("/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Look up the user by email
  const user = getUserByEmail(email, users);

  // Check if the user exists and if the password matches
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(403).send("Invalid email or password.");
  }

  // Set the user_id cookie with the matching user's ID
  req.session.user_id = user.id

  // Redirect to /urls
  res.redirect("/urls");
});

// Logout
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login");
});

// Creating new URLs - GET request
app.get("/urls/new", (req, res) => {
  // If the user is not logged in, redirect to /login
  if (!req.session.user_id) {
    return res.redirect("/login");
  }

  const templateVars = {
    user: users[req.session.user_id]
  };
  res.render("urls_new", templateVars);
});

app.get("/", (req, res) => {
  if (req.session.user_id) {
    res.redirect("/urls");
  } else {
    res.redirect("/login");
  }
});

// Extra Misc
app.get("*", (req, res, next) => {
  const userId = req.session.user_id;
  res.locals.user = userId ? users[userId] : null;
  next();
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});
