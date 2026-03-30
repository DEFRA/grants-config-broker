import fs from 'fs';
import yaml from 'js-yaml';

function main() {
  const releaseFile = 'release/release.yml';
  if (!fs.existsSync(releaseFile)) {
    console.log(`File ${releaseFile} not found`);
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `exists=false\n`);
    }
    process.exit(0);
  }

  let releaseData;
  try {
    releaseData = yaml.load(fs.readFileSync(releaseFile, 'utf8'));
  } catch (e) {
    console.error(`Error parsing ${releaseFile}: ${e.message}`);
    process.exit(1);
  }

  const name = releaseData.name;
  const version = releaseData.version;

  if (!name || !version) {
    console.error(`Missing 'name' or 'version' in ${releaseFile}`);
    process.exit(1);
  }

  const locationsFile = '.github/grant-locations.yml';
  if (!fs.existsSync(locationsFile)) {
    console.error(`File ${locationsFile} not found`);
    process.exit(1);
  }

  let locationsData;
  try {
    locationsData = yaml.load(fs.readFileSync(locationsFile, 'utf8'));
  } catch (e) {
    console.error(`Error parsing ${locationsFile}: ${e.message}`);
    process.exit(1);
  }

  const repositories = locationsData.repositories || [];
  let repoLocation = null;
  let repoDirectory = null;
  for (const repo of repositories) {
    if (repo.name === name) {
      repoLocation = repo.repository;
      repoDirectory = repo.path;
      break;
    }
  }

  if (!repoLocation) {
    console.error(`Repository for '${name}' not found in ${locationsFile}`);
    process.exit(1);
  }

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `exists=true\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `grant_name=${name}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `grant_version=${version}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `repository=${repoLocation}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `directory=${repoDirectory}\n`)
  } else {
    console.log(`exists=true`);
    console.log(`grant_name=${name}`);
    console.log(`grant_version=${version}`);
    console.log(`repository=${repoLocation}`);
    console.log(`directory=${repoDirectory}`)
  }
}

main();
