import "regenerator-runtime/runtime";
import * as nearAPI from "near-api-js";
import getConfig from "./config";
import { generateSeedPhrase } from 'near-seed-phrase'
const nearConfig = getConfig(process.env.NODE_ENV || "development");

async function connect(nearConfig) {
  // Connects to NEAR and provides `near`, `walletAccount` and `contract` objects in `window` scope
  // Initializing connection to the NEAR node.
  window.near = await nearAPI.connect({
    deps: {
      keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore()
    },
    ...nearConfig
  });

  // Needed to access wallet login
  window.walletConnection = new nearAPI.WalletConnection(window.near);

  // Initializing our contract APIs by contract name and configuration.
  window.contract = await new nearAPI.Contract(window.walletConnection.account(), nearConfig.contractName, {
    // View methods are read-only – they don't modify the state, but usually return some value
    viewMethods: ['get_num'],
    // Change methods can modify the state, but you don't receive the returned value when called
    changeMethods: ['increment', 'decrement', 'reset'],
    // Sender is the account ID to initialize transactions.
    // getAccountId() will return empty string if user is still unauthorized
    sender: window.walletConnection.getAccountId()
  });
}

let credentials = generateSeedPhrase()
let TEMP_CREATING_ACCOUNT_ID = 'TEMP_CREATING_ACCOUNT_ID'
async function createAccount(accountId) {
    window.prompt('new account seed phrase', credentials.seedPhrase)
    localStorage.setItem(TEMP_CREATING_ACCOUNT_ID, JSON.stringify({
      accountId,
      ...credentials,
    }))
    //redirects to wallet
    window.walletConnection.account.functionCall({
      contractId: nearConfig.networkId,
      methodName: 'create_account',
      args: {
        new_account_id: accountId + '.' + nearConfig.networkId,
        new_account_pk: credentials.publicKey.toString()
      },
      gas: '200000000000000', 
      attachedDeposit: '1000000000000000000000000' // 1N
    })

    // AFTER REDIRECT (e.g. when your app mounts again)
    
    const { accountId, secretKey } = localStorage.getItem(TEMP_CREATING_ACCOUNT_ID)
    if (accountId) {
      const exists = await doesAccountExist(accountId)
      // use credentials to make a new account
      const account = initAccount(accountId, secretKey)

      // NOW DEPLOY CONTRACT to the newly created account
      // only user (localStorage key/seed phrase) has control

      // e.g.
      // const contractBytes = fs.readFileSync('./out/main.wasm');
      // console.log('\n\n deploying contractBytes:', contractBytes.length, '\n\n');
      // const actions = [
      // 	deployContract(contractBytes),
      // ];
      // await account.signAndSendTransaction({ receiverId: accountId, actions });
    }
}

const initAccount = async(accountId, secret) => {
	account = new nearAPI.Account(connection, accountId);
	const newKeyPair = KeyPair.fromString(secret);
	keyStore.setKey(networkId, accountId, newKeyPair);
	return account
}

const doesAccountExist = (accountId) => {
	try {
		await new Account(window.near.connection, accountId).state();
		return true;
	} catch (e) {
		if (/does not exist while viewing/.test(e)) {
			return false
		}
		throw e;
	}
};



function errorHelper(err) {
  // if there's a cryptic error, provide more helpful feedback and instructions here
  // TODO: as soon as we get the error codes propagating back, use those
  if (err.message.includes('Cannot deserialize the contract state')) {
    console.warn('NEAR Warning: the contract/account seems to have state that is not (or no longer) compatible.\n' +
        'This may require deleting and recreating the NEAR account as shown here:\n' +
        'https://stackoverflow.com/a/60767144/711863');
  }
  if (err.message.includes('Cannot deserialize the contract state')) {
    console.warn('NEAR Warning: the contract/account seems to have state that is not (or no longer) compatible.\n' +
        'This may require deleting and recreating the NEAR account as shown here:\n' +
        'https://stackoverflow.com/a/60767144/711863');
  }
  console.error(err);
}

function updateUI() {
  if (!window.walletConnection.getAccountId()) {
    Array.from(document.querySelectorAll('.sign-in')).map(it => it.style = 'display: block;');
  } else {
    Array.from(document.querySelectorAll('.after-sign-in')).map(it => it.style = 'display: block;');
    contract.get_num().then(count => {
      document.querySelector('#show').classList.replace('loader','number');
      document.querySelector('#show').innerText = count === undefined ? 'calculating...' : count;
      document.querySelector('#left').classList.toggle('eye');
      document.querySelectorAll('button').forEach(button => button.disabled = false);
      if (count >= 0) {
        document.querySelector('.mouth').classList.replace('cry','smile');
      } else {
        document.querySelector('.mouth').classList.replace('smile','cry');
      }
      if (count > 20 || count < -20) {
        document.querySelector('.tongue').style.display = 'block';
      } else {
        document.querySelector('.tongue').style.display = 'none';
      }
    }).catch(err => errorHelper(err));
  }
}

document.querySelector('#plus').addEventListener('click', () => {
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  document.querySelector('#show').classList.replace('number','loader');
  document.querySelector('#show').innerText = '';
  contract.increment().then(updateUI);
});
document.querySelector('#minus').addEventListener('click', () => {
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  document.querySelector('#show').classList.replace('number','loader');
  document.querySelector('#show').innerText = '';
  contract.decrement().then(updateUI);
});
document.querySelector('#a').addEventListener('click', () => {
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  document.querySelector('#show').classList.replace('number','loader');
  document.querySelector('#show').innerText = '';
  contract.reset().then(updateUI);
});
document.querySelector('#c').addEventListener('click', () => {
  document.querySelector('#left').classList.toggle('eye');
});
document.querySelector('#b').addEventListener('click', () => {
  document.querySelector('#right').classList.toggle('eye');
});
document.querySelector('#d').addEventListener('click', () => {
  document.querySelector('.dot').classList.toggle('on');
});

// Log in user using NEAR Wallet on "Sign In" button click
document.querySelector('.sign-in .btn').addEventListener('click', () => {
  walletConnection.requestSignIn(nearConfig.contractName, 'Rust Counter Example');
});

document.querySelector('.sign-out .btn').addEventListener('click', () => {
  walletConnection.signOut();
  // TODO: Move redirect to .signOut() ^^^
  window.location.replace(window.location.origin + window.location.pathname);
});

window.nearInitPromise = connect(nearConfig)
    .then(updateUI)
    .catch(console.error);
