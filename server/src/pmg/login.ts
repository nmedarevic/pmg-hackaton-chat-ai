import { graphqlRequest } from '../graphqlClient';

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken {
        token
      }
    }
  }
`;

export async function loginWith(emailVar: string, passwordVar: string): Promise<string> {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    throw new Error(`${emailVar} and ${passwordVar} must be set`);
  }

  const data = await graphqlRequest({
    query: LOGIN_MUTATION,
    variables: { email, password },
    operationName: 'Login',
  });

  return (data.login as { accessToken: { token: string } }).accessToken.token;
}
