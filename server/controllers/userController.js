const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const {
  issueTokenPair,
  verifyRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} = require("../utils/jwt");

function publicUser(user) {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.password;
  return userObj;
}

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

    const tokens = await issueTokenPair(user);

    return res.json({
      status: true,
      user: publicUser(user),
      ...tokens,
    });
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

    const tokens = await issueTokenPair(user);

    return res.json({
      status: true,
      user: publicUser(user),
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.setAvatar = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const avatarImage = req.body.image;

    if (req.user.id !== userId) {
      return res.status(403).json({ isSet: false, msg: "Forbidden" });
    }

    const userData = await User.findByIdAndUpdate(
      userId,
      {
        isAvatarImageSet: true,
        avatarImage,
      },
      { returnDocument: "after" }
    );

    if (!userData) {
      return res.json({ isSet: false, msg: "User not found" });
    }

    return res.json({
      isSet: userData.isAvatarImageSet,
      image: userData.avatarImage,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rotate refresh token:
 * - validate old refresh JWT
 * - check Redis allow-list
 * - revoke old jti
 * - issue new access + refresh pair
 */
module.exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ status: false, msg: "refreshToken required" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ status: false, msg: "Invalid refresh token" });
    }

    const ok = await isRefreshTokenValid(payload.id, payload.jti);
    if (!ok) {
      return res.status(401).json({ status: false, msg: "Refresh token revoked" });
    }

    await revokeRefreshToken(payload.id, payload.jti);

    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ status: false, msg: "User not found" });
    }

    const tokens = await issueTokenPair(user);
    return res.json({ status: true, ...tokens, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};

module.exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await revokeRefreshToken(payload.id, payload.jti);
      } catch {
        // ignore invalid token on logout
      }
    } else if (req.user?.id) {
      await revokeAllRefreshTokens(req.user.id);
    }

    return res.json({ status: true, msg: "Logged out" });
  } catch (err) {
    next(err);
  }
};
