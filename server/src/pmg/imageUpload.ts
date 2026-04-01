import { graphqlRequest } from '../graphqlClient';

const CREATE_UPLOAD_FORM_MUTATION = `
  mutation CreateUploadForm($input: CreateUploadFormInput!) {
    createUploadForm(input: $input) {
      mediaId
      form { url fields }
    }
  }
`;

const CONFIRM_FILE_UPLOAD_MUTATION = `
  mutation ConfirmFileUpload($input: ConfirmFileUploadInput!) {
    confirmFileUpload(input: $input) {
      fileId
      filePreviewUrl
    }
  }
`;

export async function uploadImage(token: string, imageUrl: string): Promise<string> {
  // Step 1: download image from Stream CDN
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`);
  }
  const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
  const imageBuffer = await imageRes.arrayBuffer();

  // Step 2: get pre-signed S3 form from PMG
  const uploadData = await graphqlRequest({
    query: CREATE_UPLOAD_FORM_MUTATION,
    variables: { input: { uploadType: 'LISTING_MEDIA', contentType } },
    token,
    operationName: 'CreateUploadForm',
  });
  const { mediaId, form } = uploadData.createUploadForm as {
    mediaId: string;
    form: { url: string; fields: Record<string, string> };
  };

  // Step 3: POST directly to S3 — fields first, file last, no auth header
  const formData = new FormData();
  Object.entries(form.fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', new Blob([imageBuffer], { type: contentType }));

  const s3Res = await fetch(form.url, { method: 'POST', body: formData });
  if (s3Res.status !== 204) {
    throw new Error(`S3 upload failed with status ${s3Res.status}`);
  }

  // Step 4: confirm upload
  await graphqlRequest({
    query: CONFIRM_FILE_UPLOAD_MUTATION,
    variables: { input: { mediaId } },
    token,
    operationName: 'ConfirmFileUpload',
  });

  return mediaId;
}
