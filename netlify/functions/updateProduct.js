const { Octokit } = require("@octokit/rest");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { token, repo, owner, path, content } = JSON.parse(event.body);

  const octokit = new Octokit({ auth: token });

  try {
    const file = await octokit.repos.getContent({ owner, repo, path });
    const sha = file.data.sha;

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "Product data updated via editor",
      content: Buffer.from(content).toString("base64"),
      sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Updated", response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
