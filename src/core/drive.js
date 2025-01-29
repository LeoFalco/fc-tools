import { google } from 'googleapis'

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: 'file-uploader-366517',
    private_key_id: 'e31075b859777a5db9394974ed11f6251011ad95',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDYfryUBII0aHUx\nayTAlGgV13p934r9yBjA4ZMY97X68zqOZ/cp7wuJ+M5cssbhJz7r/8nEcGkArIkz\n1sULrCTXG9UXJYkTI6Iyvnrxpg07hEcNE5tZ+djQ8KaeYBgwfwN0OQZ50hoIM249\n3vWFLT2teOgTOxZSftdlKUQj+RuYWXnMs/lKZj9RkrmDUmKzx3m/3ogqHyVGUPPB\n2GijgOKzrn6k1lklY9bd2SDg+lqjg4pbXp3VWp/39gsL0wLjsYFw05tKkVzZqY0W\naL+oIoxALPkQ0++vnwuZnYngn5xQLKXPXUBfVcpt+VavRQsxD/sJuIvfB+fH8A5o\nEJ5XDY1RAgMBAAECggEAAg1R+eRwzEC+9x/jDFr/wVC+e8vTEkCbuPTOZ1C+QiWc\n7Ql/3I80LJutz4+/fjX4NQYStlSjLycjggj3q0qXew07y+VOfz6hyIG5Ejoq4xD3\n+DAS03OQfjsAtky2f/utN4RcmwoedmxP38DhsoBlNrQoHXoMdi3W+nHNoDppzDvs\n5+oNsu+9URxVeaaM7dBIhHoSHGPBZpRtYAfleTH/Pw8+SGLEAAHJKCOL9vypjoK6\nh3jTVwRT/ePsa/8/XQ1HV7NbLPeTWr4mkKhUZwkHBPDPqni+EXh26zzS0HWtZ91l\nUDMr7JwhnDz6QaCraEcho+7LNbigiQmiwqgUFtmKwQKBgQD8yVaWq2Scwe2GA58l\nt/Xi9bebVJWBjHpr7NqDf8zfKVjAgrc21P98crUnT6EbGteNsW2sBSsl4A9bVws5\nMR05uawlRO/+mMo8PPrKVKrRPpIyH+Q805/NDLrFEXaJ66nV2T1BplrXjnn0w+ek\nnl66HYF+1J3lVUyNhiJCl2ODEQKBgQDbP0rlf0XxBwtygdPQXtGiA/3vZoCVCPUf\ndKa7MeG7I7kMxKEMaUI1g406LbGGjV7uVmS5HAW/L91I/mbYE1DdoWJ+7fWDUMMq\nSu7ZExqR/QMtpaJvxv3SXUowIB5VyBexPsrD2sbG7wTH5mYD0O5vSOqSHxzdQ4+6\nWuAq/ojmQQKBgGb9bL7UM5i+VhSMszF94rtGWzj43DS81D/Wbyy2S/T79oHwf87i\nNvkwDuhmRAA0DnBXQpScQnka8YbITvVNMlgLcrx4esMi4vpp6c+3cSTxNkUfwzCZ\nE/lJ32pc9Au7LSXIbXGq4kYCcWOs0Vq7f2KalODkpTQDbb4XUSwKW+vRAoGAVZQd\n+viz50H1sOuGLyZjs1bVjtW2yPWnIHEbB6SP1Mk72QUDS+HmKxc/T/839SpHbMai\nKDMM9zSKroxGvn7DqM7usFbX5zrmAyMemfLAA038KJwnjHPi7XLmm2ReEuO4g8Hb\nyZkiz9HKTvDazxCFkUCn9wNX8/IELxx7tayG6UECgYBJPzfI2DbMItrwEBAqtI1A\nK5+XSjz+6Kb03OCzYMF3Y717TG8c34I14ficO3NEKHUh6atVPjCgsj/1nwOH4JcB\n1EdaQ16HLwVnRMACrfHoU56vDrAfbJtE1gxdlNtXCG8OSMTbZTngHGogn2EjBZOh\ndubt0GCzQuh1VzlJ438zWQ==\n-----END PRIVATE KEY-----\n',
    client_email: 'drive-uploader@file-uploader-366517.iam.gserviceaccount.com',
    client_id: '113144025508746701079',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/drive-uploader%40file-uploader-366517.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com'
  },
  scopes: ['https://www.googleapis.com/auth/drive']
})

export const drive = google.drive({
  version: 'v3',
  auth
})

export const admin = google.admin({
  version: 'directory_v1',
  auth
})

export const sheets = google.sheets({
  version: 'v4',
  auth
})

/**
 *
 * @param {Object} args
 * @param {string} args.fileId the id of the file to download
 * @returns {Promise<string>}
 */
export async function exportDriveFile ({ fileId }) {
  const res = await drive.files.export({
    fileId,
    mimeType: 'text/csv'
  })

  return res.data
}

export async function uploadFile ({ filename, mimeType, file }) {
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType,
      parents: ['10Y_4rxRor4SrPAV9RtHsJjfcx31urREa']
    },
    media: {
      mimeType,
      body: file
    },
    fields: 'id,webViewLink'
  })

  return res.data
}
