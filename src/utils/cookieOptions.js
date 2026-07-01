const accessTokenOptions = {
     httpOnly: true,
     secure: true,
     maxAge: 15 * 60 * 1000
};

const refreshTokenOptions = {
     httpOnly: true,
     secure: true,
     maxAge: 30 * 24 * 60 * 60 * 1000
};

export { accessTokenOptions, refreshTokenOptions }