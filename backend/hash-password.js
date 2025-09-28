import bcrypt from "bcrypt";

const run = async () => {
  const password = "anker123";
  const hash = await bcrypt.hash(password, 10);
  console.log("New hash:", hash);
};

run();
