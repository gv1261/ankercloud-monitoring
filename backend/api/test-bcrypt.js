import bcrypt from "bcrypt";

const hash = "$2b$10$kr6IIiufiTnqlaqqprdpQedoNPDIsD5amc7GmBpKnCNdIo05REB1e";

const run = async () => {
  const isMatch = await bcrypt.compare("anker123", hash);
  console.log("Password matches?", isMatch);
};

run();
