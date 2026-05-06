import * as LocalAuthentication from "expo-local-authentication";

export interface BiometricAvailability {
  available: boolean;
  label: string;
}

function biometricTypeToLabel(type: LocalAuthentication.AuthenticationType): string {
  if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) {
    return "Barmoq izi";
  }
  if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
    return "Face ID";
  }
  if (type === LocalAuthentication.AuthenticationType.IRIS) {
    return "Ko‘z skaneri";
  }
  return "Biometrik";
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    if (!hasHardware || !isEnrolled) {
      return { available: false, label: "Biometrik" };
    }

    const firstType = supportedTypes?.[0];
    return {
      available: true,
      label: typeof firstType === "number" ? biometricTypeToLabel(firstType) : "Biometrik",
    };
  } catch {
    return { available: false, label: "Biometrik" };
  }
}

export async function authenticateWithBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "PIN kod",
      cancelLabel: "Bekor qilish",
      disableDeviceFallback: false,
    });

    return Boolean(result.success);
  } catch {
    return false;
  }
}
