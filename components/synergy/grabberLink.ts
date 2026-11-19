// The bookmark people drag to their bookmarks bar. It is a short loader: on the Schoology page it adds the helper script from
// Synergy's own address; anywhere else it just explains what to do.
export function grabberLink(appOrigin: string, schoologyOrigin: string): string {
  const code =
    `(function(){try{` +
    `if(location.origin!==${JSON.stringify(schoologyOrigin)}){alert('Open your Schoology page and sign in first, then click this bookmark there.');return}` +
    `var s=document.createElement('script');` +
    `s.src=${JSON.stringify(`${appOrigin}/synergy-grabber.js`)}+'?'+Date.now();` +
    `s.onerror=function(){alert('Synergy could not start on this page. Use the Synergy desktop app instead, and import the file it exports.')};` +
    `document.documentElement.appendChild(s)` +
    `}catch(e){alert('Something went wrong: '+e.message)}})()`
  return `javascript:${encodeURIComponent(code)}`
}
