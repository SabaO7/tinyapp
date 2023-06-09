const express = require("express");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const app = express();
const PORT = 8080;

app.set("view engine", "ejs");

const {
  generateRandomString,
  hasUser,
  getUserByEmail
} = require("./helpers");

const urlDatabase = {
  "b2xVn2": "http://www.lighthouselabs.ca",
  "9sm5xK": "http://www.google.com"
};

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cookieSession({
    name: "session",
    keys: ["Cool"],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  })
);

const users = {
  userRandomID: {
    id: "userRandomID",
    email: "user@example.com",
    password: "purple-monkey-dinosaur"
  },
  user2RandomID: {
    id: "user2RandomID",
    email: "user2@example.com",
    password: "dishwasher-funk"
  }
};

// Homepage
app.get("/urls", (req, res) => {
  const templateVars = {
    urls: urlDatabase,
    user: users[req.session.user_id]
  };
  res.render("urls_index", templateVars);
});

// Creating new urls
app.get("/urls/new", (req, res) => {
  const templateVars = {
    user: users[req.session.user_id]
  };
  res.render("urls_new", templateVars);
});

app.get("/urls/:id", (req, res) => {
  const templateVars = {
    id: req.params.id,
    longURL: urlDatabase[req.params.id]
  };
  res.render("urls_show", templateVars);
});

app.get("/u/:id", (req, res) => {
  const longURL = urlDatabase[req.params.id];
  res.redirect(longURL);
});

app.post("/urls", (req, res) => {
  if (hasUser(req.session.user_id, users)) {
    if (!hasURL(req.body.longURL, urlDatabase, req.session.user_id)) {
      //checks if the URL has been made for that user
      let shortURL = generateRandomString();
      urlDatabase[shortURL] = {
        longURL: req.body.longURL,
        userID: req.session.user_id,
      };
    }
  }
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

app.post("/urls", (req, res) => {
  const id = generateRandomString();
  const longURL = req.body.longURL;
  urlDatabase[id] = longURL;
  res.redirect(`/urls/${id}`);
});

app.post("/urls/:id/delete", (req, res) => {
  const id = req.params.id;
  delete urlDatabase[id];
  res.redirect("/urls");
});

app.post("/urls/:id/update", (req, res) => {
  const id = req.params.id;
  const newLongURL = req.body.longURL;
  urlDatabase[id] = newLongURL;
  res.redirect(`/urls/${id}`);
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
  const user = getUserByEmail(email);

  // Check if the user exists and if the password matches
  if (!user || !bcrypt.compareSync(password, user.password)) {
    res.status(403).send("Invalid email or password.");
    return;
  }

  if (hasUser(req.body.email, users)) {
    //if you try logging in with the right email
    const id = getUserByEmail(req.body.email, users);
    if (bcrypt.compareSync(req.body.password, users[id].password)) {
      //if you login with the right password
      req.session.user_id = id;
      res.redirect("/urls");
    } else {
      res.status(403).send("The password does not match.");
    }
  } else {
    res.status(403).send("The email could not be found");
  }

  // Set the user_id cookie with the matching user's ID
  req.session.user_id = user.id;

  // Redirect to /urls
  res.redirect("/urls");
});

// Logout
app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login");
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
