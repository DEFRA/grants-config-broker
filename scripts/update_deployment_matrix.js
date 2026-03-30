import fs from 'fs';
import yaml from 'js-yaml';

function upsertVersion(array, newItem) {
  const index = array.findIndex(item => item.number === newItem.number);

  if (index !== -1) {
    array[index] = { ...array[index], ...newItem };
  } else {
    array.push(newItem);
  }
}

function createNewGrantEntry(name, grants) {
  const newGrant = {
    name,
    envs: [
      { name: 'dev', versions: [] },
      { name: 'test', versions: []},
      { name: 'ext-test', versions: []},
      { name: 'perf-test', versions: []},
      { name: 'prod', versions: []},
    ]
  };
  grants.push(newGrant);
  return newGrant;
}

function main() {
  const releaseFile = 'release/release.yml';
  const matrixFile = 'release/deployment-matrix.yml';
  if (!fs.existsSync(releaseFile) || !fs.existsSync(matrixFile)) {
    console.log(`Files ${releaseFile} / ${matrixFile} not found, unable to update deployment matrix`);
    process.exit(0);
  }

  let releaseData;
  let matrixData;
  try {
    releaseData = yaml.load(fs.readFileSync(releaseFile, 'utf8'));
    matrixData = yaml.load(fs.readFileSync(matrixFile, 'utf8'));
  } catch (e) {
    console.error(`Error parsing input files: ${e.message}`);
    process.exit(1);
  }

  const name = releaseData.name;
  const version = releaseData.version;

   const grants = matrixData.grants || [];
   //find the grant that matches the name in release
   const grant = grants.find(grant => grant.name === name) ?? createNewGrantEntry(name, grants);
   //go through the envs array in release and update entries in matrix accordingly
  for (const eachEnv of releaseData.environments) {
    //skip if status is none
    if(eachEnv.status === 'none') continue;

    const matrixEnvEntry = grant.envs.find(env => env.name === eachEnv.name) ?? { name: eachEnv.name };
    upsertVersion(matrixEnvEntry.versions, { number: version, status: eachEnv.status });
  }

  matrixData.lastUpdated = ((d) => `${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}_${String(d.getDate()).padStart(2, '0')}__${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`)(new Date());
  try {
    fs.writeFileSync(matrixFile, yaml.dump(matrixData));
  } catch (e) {
    console.error(`Error writing output file: ${e.message}`);
    process.exit(1);
  }
}

main();
