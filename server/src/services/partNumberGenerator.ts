interface PartNumberVars {
  customer_code: string;
  foam_grade: string;
  L: string;
  W: string;
  H: string;
  density?: string;
  dacron?: string;
  quantity?: string;
}

export function generatePartNumber(template: string, vars: PartNumberVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}
