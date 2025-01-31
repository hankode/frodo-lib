import {
  createKeyValueTable,
  createProgressIndicator,
  createTable,
  printMessage,
  stopProgressIndicator,
  updateProgressIndicator,
} from './utils/Console';
import {
  deleteVariable,
  getVariable,
  getVariables,
  putVariable,
  setVariableDescription,
} from '../api/VariablesApi';
import wordwrap from './utils/Wordwrap';
import { resolveUserName } from './ManagedObjectOps';
import { decode } from '../api/utils/Base64';

/**
 * List variables
 * @param {boolean} long Long version, all the fields
 */
export async function listVariables(long) {
  let variables = [];
  try {
    variables = (await getVariables()).result;
  } catch (error) {
    printMessage(`${error.message}`, 'error');
    printMessage(error.response.data, 'error');
  }
  if (long) {
    const table = createTable([
      'Id'['brightCyan'],
      'Value'['brightCyan'],
      'Status'['brightCyan'],
      'Description'['brightCyan'],
      'Modifier'['brightCyan'],
      'Modified'['brightCyan'],
    ]);
    variables.sort((a, b) => a._id.localeCompare(b._id));
    for (const variable of variables) {
      table.push([
        variable._id,
        wordwrap(decode(variable.valueBase64), 40),
        variable.loaded ? 'loaded'['brightGreen'] : 'unloaded'['brightRed'],
        wordwrap(variable.description, 40),
        // eslint-disable-next-line no-await-in-loop
        await resolveUserName('teammember', variable.lastChangedBy),
        new Date(variable.lastChangeDate).toLocaleString(),
      ]);
    }
    printMessage(table.toString());
  } else {
    variables.forEach((secret) => {
      printMessage(secret._id);
    });
  }
}

/**
 * Create variable
 * @param {String} variableId variable id
 * @param {String} value variable value
 * @param {String} description variable description
 */
export async function createVariable(variableId, value, description) {
  createProgressIndicator(
    undefined,
    `Creating variable ${variableId}...`,
    'indeterminate'
  );
  try {
    await putVariable(variableId, value, description);
    stopProgressIndicator(`Created variable ${variableId}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Update variable
 * @param {String} variableId variable id
 * @param {String} value variable value
 * @param {String} description variable description
 */
export async function updateVariable(variableId, value, description) {
  createProgressIndicator(
    undefined,
    `Updating variable ${variableId}...`,
    'indeterminate'
  );
  try {
    await putVariable(variableId, value, description);
    stopProgressIndicator(`Updated variable ${variableId}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Set description of variable
 * @param {String} variableId variable id
 * @param {String} description variable description
 */
export async function setDescriptionOfVariable(variableId, description) {
  createProgressIndicator(
    undefined,
    `Setting description of variable ${variableId}...`,
    'indeterminate'
  );
  try {
    await setVariableDescription(variableId, description);
    stopProgressIndicator(
      `Set description of variable ${variableId}`,
      'success'
    );
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Delete a variable
 * @param {String} variableId variable id
 */
export async function deleteVariableCmd(variableId) {
  createProgressIndicator(
    undefined,
    `Deleting variable ${variableId}...`,
    'indeterminate'
  );
  try {
    await deleteVariable(variableId);
    stopProgressIndicator(`Deleted variable ${variableId}`, 'success');
  } catch (error) {
    stopProgressIndicator(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'fail'
    );
  }
}

/**
 * Delete all variables
 */
export async function deleteVariablesCmd() {
  try {
    const variables = (await getVariables()).result;
    createProgressIndicator(variables.length, `Deleting variable...`);
    for (const variable of variables) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await deleteVariable(variable._id);
        updateProgressIndicator(`Deleted variable ${variable._id}`);
      } catch (error) {
        printMessage(
          `Error: ${error.response.data.code} - ${error.response.data.message}`,
          'error'
        );
      }
    }
    stopProgressIndicator(`Variables deleted.`);
  } catch (error) {
    printMessage(
      `Error: ${error.response.data.code} - ${error.response.data.message}`,
      'error'
    );
  }
}

/**
 * Describe a variable
 * @param {String} variableId variable id
 */
export async function describeVariable(variableId) {
  const variable = await getVariable(variableId);
  const table = createKeyValueTable();
  table.push(['Name'['brightCyan'], variable._id]);
  table.push([
    'Value'['brightCyan'],
    wordwrap(decode(variable.valueBase64), 40),
  ]);
  table.push([
    'Status'['brightCyan'],
    variable.loaded ? 'loaded'['brightGreen'] : 'unloaded'['brightRed'],
  ]);
  table.push(['Description'['brightCyan'], wordwrap(variable.description, 60)]);
  table.push([
    'Modified'['brightCyan'],
    new Date(variable.lastChangeDate).toLocaleString(),
  ]);
  table.push([
    'Modifier'['brightCyan'],
    await resolveUserName('teammember', variable.lastChangedBy),
  ]);
  table.push(['Modifier UUID'['brightCyan'], variable.lastChangedBy]);
  printMessage(table.toString());
}
