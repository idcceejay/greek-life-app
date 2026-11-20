import { readFile } from 'node:fs/promises';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;

if (!repository || !token) {
  console.error(
    'GITHUB_REPOSITORY or GITHUB_TOKEN is not set. Add both to the preview environment of the Expo Services project.'
  );
  process.exit(1);
}

async function request(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `GitHub returned ${response.status} for ${method} ${path}: ${await response.text()}\nCheck that GITHUB_TOKEN can read and write contents, issues, and pull requests in ${repository}.`
    );
  }
  return response.json();
}

const repo = `/repos/${repository}`;
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'issue': {
    const issue = await request('GET', `${repo}/issues/${args[0]}`);
    const comments = await request('GET', `${repo}/issues/${args[0]}/comments?per_page=50`);
    console.log(
      JSON.stringify(
        {
          title: issue.title,
          body: issue.body,
          comments: comments
            .filter(comment =>
              ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(comment.author_association)
            )
            .map(comment => comment.body),
        },
        null,
        2
      )
    );
    break;
  }
  case 'comment': {
    await request('POST', `${repo}/issues/${args[0]}/comments`, {
      body: await readFile(args[1], 'utf8'),
    });
    break;
  }
  case 'create-issue': {
    const [title, bodyFile, ...labels] = args;
    const issue = await request('POST', `${repo}/issues`, {
      title,
      body: await readFile(bodyFile, 'utf8'),
      labels,
    });
    console.log(issue.number);
    break;
  }
  case 'open-pull-request': {
    const [branch, title, bodyFile] = args;
    const owner = repository.split('/')[0];
    const open = await request('GET', `${repo}/pulls?state=open&head=${owner}:${branch}`);
    if (open.length > 0) {
      console.log(open[0].html_url);
      break;
    }
    const { default_branch: base } = await request('GET', repo);
    const pullRequest = await request('POST', `${repo}/pulls`, {
      head: branch,
      base,
      title,
      body: await readFile(bodyFile, 'utf8'),
    });
    console.log(pullRequest.html_url);
    break;
  }
  case 'author-email': {
    const user = await request('GET', '/user');
    console.log(`${user.id}+${user.login}@users.noreply.github.com`);
    break;
  }
  default:
    console.error(
      `Unknown command "${command}". Use issue, comment, create-issue, open-pull-request, or author-email.`
    );
    process.exit(1);
}
