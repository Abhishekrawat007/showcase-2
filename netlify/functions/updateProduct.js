const { Octokit } = require("@octokit/rest");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: "Missing GitHub token in environment variables.",
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { owner, repo, path, content } = body;

    const octokit = new Octokit({ auth: token });

    // Get existing file to fetch its SHA
    const { data: existingFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    const sha = existingFile.sha;

    // Update file
    const updateResponse = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "Update product data via Netlify Function",
      content: Buffer.from(content).toString("base64"),
      sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "File updated successfully!",
        url: updateResponse.data.content.html_url,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
