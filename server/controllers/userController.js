const User = require("../models/userModel");
const bcrypt = require("bcrypt");

module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const usernameCheck = await User.findOne({ username });
    if (usernameCheck) {
      return res.json({ status: false, msg: "Username already used" });
    }

    const emailCheck = await User.findOne({ email });
    if (emailCheck) {
      return res.json({ status: false, msg: "Email already used" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ status: true, user: userObj });
  } catch (err) {
    next(err);
  }
};

module.exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ status: false, msg: "Incorrect username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.json({ status: false, msg: "Incorrect username or password" });
    }

    const userObj = user.toObject();
    delete userObj.password;

    return res.json({ status: true, user: userObj });
  } catch (err) {
    next(err);
  }
};