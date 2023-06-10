const express = require("express");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const password = "purple-monkey-dinosaur"; // found in the req.body object
const hashedPassword = bcrypt.hashSync(password, 10);
const app = express();
const PORT = 8080;

app.set("view engine", "ejs");

const {
  generateRandomString,
  hasUser,
  getUserByEmail
} = require("./helpers");

const urlDatabase = {
  "b2xVn2": { longURL: "http://www.lighthouselabs.ca", userID: "userRandomID" },
  "9sm5xK": { longURL: "http://www.google.com", userID: "user2RandomID" }
};


app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: "session",
    keys: ["Test"],
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

const urlsForUser = (id) => {
  return Object.keys(urlDatabase).filter(shortURL => urlDatabase[shortURL].userID === id)
    .reduce((result, shortURL) => {
      result[shortURL] = urlDatabase[shortURL];
      return result;
    }, {});
}

// Homepage
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

app.get("/u/:id", (req, res) => {
  const shortURL = req.params.id;
  const url = urlDatabase[shortURL];
  
  // Check if the shortURL exists in the database
  if (!url) {
    // Respond with an HTML error message
    return res.status(404).send("<h1>Error: The short URL does not exist!</h1>");
  }

  // Redirect to the long URL
  res.redirect(url.longURL);
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

// Registration Page
app.get("/register", (req, res) => {
  // If the user is logged in, redirect to /urls
  if (req.session.user_id) {
    return res.redirect("/urls");
  }

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
  res.redirect(`/urls/${shortURL}`);
});



// Login
app.get("/login", (req, res) => {
  // If the user is logged in, redirect to /urls
  if (req.session.user_id) {
    return res.redirect("/urls");
  }

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
  req.session.userId = user.id;

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
