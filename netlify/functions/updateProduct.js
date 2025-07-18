const { Octokit } = require("@octokit/rest");
const token = process.env.GITHUB_TOKEN;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const body = JSON.parse(event.body);
  const { owner, repo, path, content } = body;

  const octokit = new Octokit({ auth: token });

  try {
    // Get the existing file SHA
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const sha = existingFile.sha;

    const updateResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "Update product data via Netlify Function",
      content: Buffer.from(content).toString("base64"),
      sha: sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "File updated successfully!", url: updateResponse.data.content.html_url }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
