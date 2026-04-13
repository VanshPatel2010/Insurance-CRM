"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveCustomer,
  updateCustomer,
  getCustomer,
  flattenCustomer,
} from "@/lib/storage";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_ISO2,
} from "@/lib/countryCallingCodes";
import { calculateAge } from "@/lib/utils";
import {
  Policy,
  PolicyType,
  MotorPolicy,
  MedicalPolicy,
  FirePolicy,
  LifePolicy,
  MemberInfo,
  TravelPolicy,
  Traveler,
} from "@/lib/types";
import {
  Car,
  Heart,
  Flame,
  Shield,
  User,
  Ship,
  Briefcase,
  Plane,
  Check,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  Upload,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const typeOptions: {
  type: PolicyType;
  label: string;
  desc: string;
  icon: any;
  color: string;
  bg: string;
}[] = [
  {
    type: "motor",
    label: "Motor",
    desc: "Vehicle / Auto insurance",
    icon: Car,
    color: "#185FA5",
    bg: "#e9f2fc",
  },
  {
    type: "medical",
    label: "Medical",
    desc: "Health & hospitalization",
    icon: Heart,
    color: "#3B6D11",
    bg: "#edf7e4",
  },
  {
    type: "fire",
    label: "Fire",
    desc: "Property & fire coverage",
    icon: Flame,
    color: "#BA7517",
    bg: "#fef4e0",
  },
  {
    type: "life",
    label: "Life",
    desc: "Life & term insurance",
    icon: Shield,
    color: "#534AB7",
    bg: "#eeecfb",
  },
  {
    type: "personal-accident",
    label: "Personal Accident",
    desc: "Accidental death & disability cover",
    icon: User,
    color: "#a33b2d",
    bg: "#fcebe8",
  },
  {
    type: "marine",
    label: "Marine Insurance",
    desc: "Cargo, shipment & transit coverage",
    icon: Ship,
    color: "#0a6c74",
    bg: "#e6f7f8",
  },
  {
    type: "workman-compensation",
    label: "Workman Compensation",
    desc: "Employee injury & employer liability",
    icon: Briefcase,
    color: "#6b4f1d",
    bg: "#f8f0df",
  },
  {
    type: "travel",
    label: "Travel",
    desc: "Domestic & international trips",
    icon: Plane,
    color: "#0891b2",
    bg: "#ecf7fa",
  },
];

type Errors = Record<string, string>;

// ── Field component — defined at module level, never remounts ─────────────────
function Field({
  label,
  name,
  required,
  error,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={name}>
        {label} {required && <span className="required">*</span>}
      </label>
      {children}
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// ── Empty state factories ─────────────────────────────────────────────────────
const emptyBase = () => ({
  customerName: "",
  phoneCountryIso2: DEFAULT_COUNTRY_ISO2,
  phone: "",
  email: "",
  address: "",
  policyNumber: "",
  sumInsured: "",
  premiumAmount: "",
  startDate: "",
  endDate: "",
});
const emptyMotor = (): Omit<MotorPolicy, keyof Policy> =>
  ({
    vehicleMake: "",
    vehicleModel: "",
    vehicleYear: "",
    registrationNumber: "",
    engineCC: "",
    fuelType: "",
    idvValue: "",
    ncbPercent: "",
    addOns: "",
  }) as unknown as Omit<MotorPolicy, keyof Policy>;
const emptyMedical = () => ({
  dateOfBirth: "",
  age: "",
  gender: "" as "" | "Male" | "Female" | "Other",
  bloodGroup: "",
  preExistingConditions: "",
  smoker: "" as "" | "Yes" | "No",
  numberOfMembers: "1",
  members: [{ name: "", age: "" }] as MemberInfo[],
  cashlessHospitalNetwork: "",
});
const emptyFire = () => ({
  propertyType: "" as "" | "Residential" | "Commercial" | "Industrial",
  propertyAddress: "",
  builtUpArea: "",
  constructionType: "" as "" | "RCC" | "Wood" | "Mixed",
  propertyValue: "",
  stockValue: "",
  riskLocation: "",
});
const emptyLife = () => ({
  dateOfBirth: "",
  age: "",
  gender: "" as "" | "Male" | "Female" | "Other",
  occupation: "",
  annualIncome: "",
  smoker: "" as "" | "Yes" | "No",
  nomineeName: "",
  nomineeRelation: "",
  lifePolicyType: "" as "" | "Term" | "Endowment" | "ULIP" | "Money Back",
  sumAssured: "",
  premiumFrequency: "" as "" | "Monthly" | "Quarterly" | "Annual",
  maturityDate: "",
  policyTerm: "",
});
const emptyPersonalAccident = () => ({
  occupation: "",
  nomineeName: "",
  nomineeRelation: "",
  coverageType: "",
  disabilityCover: "",
  riskClass: "",
});
const emptyMarine = () => ({
  marineInsuranceType: "",
  cargoType: "",
  voyageFrom: "",
  voyageTo: "",
  transitMode: "",
  vesselName: "",
});
const emptyWorkmanCompensation = () => ({
  employeeCount: "",
  industryType: "",
  totalWages: "",
  riskCategory: "",
  coverageLocation: "",
  employerLiabilityLimit: "",
});
const emptyTravel = () => ({
  tripType: "" as "" | "Domestic" | "International",
  destination: [] as string[],
  tripStartDate: "",
  tripEndDate: "",
  numberOfTravelers: "1",
  travelers: [{ name: "", age: "", relationship: "" }] as Traveler[],
  visaType: "",
  preExistingConditions: "",
  activitiesCovered: [] as string[],
  coverageAmount: "",
  coverageType: "" as
    | ""
    | "Trip Cancellation"
    | "Medical"
    | "Baggage Loss"
    | "All-Risk",
});

function parseStoredPhone(value: unknown) {
  const cleanedPhone = String(value ?? "").replace(/\D/g, "");

  if (!cleanedPhone) {
    return { phoneCountryIso2: DEFAULT_COUNTRY_ISO2, phone: "" };
  }

  if (cleanedPhone.length <= 10) {
    return { phoneCountryIso2: DEFAULT_COUNTRY_ISO2, phone: cleanedPhone };
  }

  const matchedCountry = [...COUNTRY_CALLING_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find(
      (country) =>
        cleanedPhone.startsWith(country.dialCode) &&
        cleanedPhone.length > country.dialCode.length,
    );

  if (!matchedCountry) {
    return { phoneCountryIso2: DEFAULT_COUNTRY_ISO2, phone: cleanedPhone };
  }

  return {
    phoneCountryIso2: matchedCountry.iso2,
    phone: cleanedPhone.slice(matchedCountry.dialCode.length),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NewCustomerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<PolicyType | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [mounted, setMounted] = useState(false);

  const [base, setBase] = useState(emptyBase());
  const [motor, setMotor] = useState(emptyMotor());
  const [medical, setMedical] = useState(emptyMedical());
  const [fire, setFire] = useState(emptyFire());
  const [life, setLife] = useState(emptyLife());
  const [personalAccident, setPersonalAccident] = useState(
    emptyPersonalAccident(),
  );
  const [marine, setMarine] = useState(emptyMarine());
  const [workmanCompensation, setWorkmanCompensation] = useState(
    emptyWorkmanCompensation(),
  );
  const [travel, setTravel] = useState(emptyTravel());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── PDF mode state ────────────────────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<"manual" | "pdf">("manual");
  const [wasExtracted, setWasExtracted] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileError, setFileError] = useState("");
  const [extractionError, setExtractionError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing customer for edit mode ──────────────────────────────────
  useEffect(() => {
    if (!editId) {
      setMounted(true);
      return;
    }
    getCustomer(editId)
      .then((doc) => {
        const p = flattenCustomer(doc);
        const parsedPhone = parseStoredPhone(p.phone);
        setSelectedType(p.type as PolicyType);
        setStep(2);
        setBase({
          customerName: String(p.customerName ?? ""),
          phoneCountryIso2: parsedPhone.phoneCountryIso2,
          phone: parsedPhone.phone,
          email: String(p.email ?? ""),
          address: String(p.address ?? ""),
          policyNumber: String(p.policyNumber ?? ""),
          sumInsured: String(p.sumInsured ?? ""),
          premiumAmount: String(p.premiumAmount ?? ""),
          startDate: String(p.startDate ?? ""),
          endDate: String(p.endDate ?? ""),
        });
        const d = p.details as Record<string, unknown>;
        if (p.type === "motor") {
          setMotor({
            vehicleMake: String(d.vehicleMake ?? ""),
            vehicleModel: String(d.vehicleModel ?? ""),
            vehicleYear: String(d.vehicleYear ?? ""),
            registrationNumber: String(d.registrationNumber ?? ""),
            engineCC: String(d.engineCC ?? ""),
            fuelType: String(d.fuelType ?? "") as MotorPolicy["fuelType"],
            idvValue: String(d.idvValue ?? ""),
            ncbPercent: String(d.ncbPercent ?? ""),
            addOns: String(d.addOns ?? ""),
          } as unknown as Omit<MotorPolicy, keyof Policy>);
        } else if (p.type === "medical") {
          setMedical({
            dateOfBirth: String(d.dateOfBirth ?? ""),
            age: String(d.age ?? ""),
            gender: (d.gender as MedicalPolicy["gender"]) ?? "",
            bloodGroup: String(d.bloodGroup ?? ""),
            preExistingConditions: String(d.preExistingConditions ?? ""),
            smoker: (d.smoker as MedicalPolicy["smoker"]) ?? "",
            numberOfMembers: String(d.numberOfMembers ?? "1"),
            members: (d.members as MemberInfo[]) ?? [{ name: "", age: "" }],
            cashlessHospitalNetwork: String(d.cashlessHospitalNetwork ?? ""),
          });
        } else if (p.type === "fire") {
          setFire({
            propertyType: (d.propertyType as FirePolicy["propertyType"]) ?? "",
            propertyAddress: String(d.propertyAddress ?? ""),
            builtUpArea: String(d.builtUpArea ?? ""),
            constructionType:
              (d.constructionType as FirePolicy["constructionType"]) ?? "",
            propertyValue: String(d.propertyValue ?? ""),
            stockValue: String(d.stockValue ?? ""),
            riskLocation: String(d.riskLocation ?? ""),
          });
        } else if (p.type === "life") {
          setLife({
            dateOfBirth: String(d.dateOfBirth ?? ""),
            age: String(d.age ?? ""),
            gender: (d.gender as LifePolicy["gender"]) ?? "",
            occupation: String(d.occupation ?? ""),
            annualIncome: String(d.annualIncome ?? ""),
            smoker: (d.smoker as LifePolicy["smoker"]) ?? "",
            nomineeName: String(d.nomineeName ?? ""),
            nomineeRelation: String(d.nomineeRelation ?? ""),
            lifePolicyType:
              (d.lifePolicyType as LifePolicy["lifePolicyType"]) ?? "",
            sumAssured: String(d.sumAssured ?? ""),
            premiumFrequency:
              (d.premiumFrequency as LifePolicy["premiumFrequency"]) ?? "",
            maturityDate: String(d.maturityDate ?? ""),
            policyTerm: String(d.policyTerm ?? ""),
          });
        } else if (p.type === "personal-accident") {
          setPersonalAccident({
            occupation: String(d.occupation ?? ""),
            nomineeName: String(d.nomineeName ?? ""),
            nomineeRelation: String(d.nomineeRelation ?? ""),
            coverageType: String(d.coverageType ?? ""),
            disabilityCover: String(d.disabilityCover ?? ""),
            riskClass: String(d.riskClass ?? ""),
          });
        } else if (p.type === "marine") {
          setMarine({
            marineInsuranceType: String(d.marineInsuranceType ?? ""),
            cargoType: String(d.cargoType ?? ""),
            voyageFrom: String(d.voyageFrom ?? ""),
            voyageTo: String(d.voyageTo ?? ""),
            transitMode: String(d.transitMode ?? ""),
            vesselName: String(d.vesselName ?? ""),
          });
        } else if (p.type === "workman-compensation") {
          setWorkmanCompensation({
            employeeCount: String(d.employeeCount ?? ""),
            industryType: String(d.industryType ?? ""),
            totalWages: String(d.totalWages ?? ""),
            riskCategory: String(d.riskCategory ?? ""),
            coverageLocation: String(d.coverageLocation ?? ""),
            employerLiabilityLimit: String(d.employerLiabilityLimit ?? ""),
          });
        } else if (p.type === "travel") {
          setTravel({
            tripType: String(d.tripType ?? "") as TravelPolicy["tripType"],
            destination: (d.destination as string[]) || [],
            tripStartDate: String(d.tripStartDate ?? ""),
            tripEndDate: String(d.tripEndDate ?? ""),
            numberOfTravelers: String(d.numberOfTravelers ?? "1"),
            travelers: (
              (d.travelers as any[]) || [
                { name: "", age: "", relationship: "" },
              ]
            ).map((t) => ({
              name: String(t?.name ?? ""),
              age: t?.age != null ? String(t.age) : "",
              relationship: String(t?.relationship ?? ""),
            })),
            visaType: String(d.visaType ?? ""),
            preExistingConditions: String(d.preExistingConditions ?? ""),
            activitiesCovered: (d.activitiesCovered as string[]) || [],
            coverageAmount: String(d.coverageAmount ?? ""),
            coverageType: String(
              d.coverageType ?? "",
            ) as TravelPolicy["coverageType"],
          });
        }
      })
      .catch(() => router.push("/dashboard/customers"))
      .finally(() => setMounted(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  if (!mounted) return null;

  // ── Auto-fill helper ──────────────────────────────────────────────────────
  function autoFillForm(data: Record<string, unknown>) {
    if (!data) return;
    const d = (data.details ?? {}) as Record<string, unknown>;
    const type = data.type as PolicyType | undefined;
    const parsedPhone = parseStoredPhone(data.phone);

    if (
      type &&
      [
        "motor",
        "medical",
        "fire",
        "life",
        "personal-accident",
        "marine",
        "workman-compensation",
        "travel",
      ].includes(type)
    ) {
      setSelectedType(type);
    }

    setBase({
      customerName: String(data.customerName ?? ""),
      phoneCountryIso2: parsedPhone.phoneCountryIso2,
      phone: parsedPhone.phone,
      email: String(data.email ?? ""),
      address: String(data.address ?? ""),
      policyNumber: String(data.policyNumber ?? ""),
      sumInsured: data.sumInsured != null ? String(data.sumInsured) : "",
      premiumAmount: data.premium != null ? String(data.premium) : "",
      startDate: String(data.startDate ?? ""),
      endDate: String(data.endDate ?? ""),
    });

    if (type === "motor") {
      setMotor({
        vehicleMake: String(d.make ?? ""),
        vehicleModel: String(d.model ?? ""),
        vehicleYear: d.year != null ? String(d.year) : "",
        registrationNumber: String(d.vehicleReg ?? ""),
        engineCC: d.engineCC != null ? String(d.engineCC) : "",
        fuelType: String(d.fuelType ?? "") as MotorPolicy["fuelType"],
        idvValue: d.idvValue != null ? String(d.idvValue) : "",
        ncbPercent: d.ncb != null ? String(d.ncb) : "",
        addOns: Array.isArray(d.addOns)
          ? (d.addOns as string[]).join(", ")
          : String(d.addOns ?? ""),
      } as unknown as Omit<MotorPolicy, keyof Policy>);
    } else if (type === "medical") {
      const dob = String(d.dateOfBirth ?? "");
      const memberNames = Array.isArray(d.memberNames)
        ? (d.memberNames as string[])
        : [];
      const count =
        d.membersCount != null
          ? Number(d.membersCount)
          : Math.max(1, memberNames.length);
      const members: MemberInfo[] = Array.from({ length: count }, (_, i) => ({
        name: memberNames[i] ?? "",
        age: "",
      }));
      setMedical({
        dateOfBirth: dob,
        age: dob
          ? String(calculateAge(dob))
          : d.age != null
            ? String(d.age)
            : "",
        gender: String(d.gender ?? "") as MedicalPolicy["gender"],
        bloodGroup: String(d.bloodGroup ?? ""),
        preExistingConditions: String(d.preExistingConditions ?? ""),
        smoker:
          d.smoker === true
            ? "Yes"
            : d.smoker === false
              ? "No"
              : ("" as MedicalPolicy["smoker"]),
        numberOfMembers: String(count),
        members,
        cashlessHospitalNetwork: String(d.cashlessNetwork ?? ""),
      });
    } else if (type === "fire") {
      setFire({
        propertyType: String(
          d.propertyType ?? "",
        ) as FirePolicy["propertyType"],
        propertyAddress: String(d.propertyAddress ?? ""),
        builtUpArea: d.builtUpArea != null ? String(d.builtUpArea) : "",
        constructionType: String(
          d.constructionType ?? "",
        ) as FirePolicy["constructionType"],
        propertyValue: d.propertyValue != null ? String(d.propertyValue) : "",
        stockValue: d.stockValue != null ? String(d.stockValue) : "",
        riskLocation: String(d.riskLocation ?? ""),
      });
    } else if (type === "life") {
      const dob = String(d.dateOfBirth ?? "");
      setLife({
        dateOfBirth: dob,
        age: dob
          ? String(calculateAge(dob))
          : d.age != null
            ? String(d.age)
            : "",
        gender: String(d.gender ?? "") as LifePolicy["gender"],
        occupation: String(d.occupation ?? ""),
        annualIncome: d.annualIncome != null ? String(d.annualIncome) : "",
        smoker:
          d.smoker === true
            ? "Yes"
            : d.smoker === false
              ? "No"
              : ("" as LifePolicy["smoker"]),
        nomineeName: String(d.nomineeName ?? ""),
        nomineeRelation: String(d.nomineeRelation ?? ""),
        lifePolicyType: String(
          d.policyType ?? "",
        ) as LifePolicy["lifePolicyType"],
        sumAssured: data.sumInsured != null ? String(data.sumInsured) : "",
        premiumFrequency: String(
          d.premiumFrequency ?? "",
        ) as LifePolicy["premiumFrequency"],
        maturityDate: String(d.maturityDate ?? ""),
        policyTerm: d.policyTerm != null ? String(d.policyTerm) : "",
      });
    } else if (type === "personal-accident") {
      setPersonalAccident({
        occupation: String(d.occupation ?? ""),
        nomineeName: String(d.nomineeName ?? ""),
        nomineeRelation: String(d.nomineeRelation ?? ""),
        coverageType: String(d.coverageType ?? ""),
        disabilityCover: String(d.disabilityCover ?? ""),
        riskClass: String(d.riskClass ?? ""),
      });
    } else if (type === "marine") {
      setMarine({
        marineInsuranceType: String(d.marineInsuranceType ?? ""),
        cargoType: String(d.cargoType ?? ""),
        voyageFrom: String(d.voyageFrom ?? ""),
        voyageTo: String(d.voyageTo ?? ""),
        transitMode: String(d.transitMode ?? ""),
        vesselName: String(d.vesselName ?? ""),
      });
    } else if (type === "workman-compensation") {
      setWorkmanCompensation({
        employeeCount: d.employeeCount != null ? String(d.employeeCount) : "",
        industryType: String(d.industryType ?? ""),
        totalWages: d.totalWages != null ? String(d.totalWages) : "",
        riskCategory: String(d.riskCategory ?? ""),
        coverageLocation: String(d.coverageLocation ?? ""),
        employerLiabilityLimit:
          d.employerLiabilityLimit != null
            ? String(d.employerLiabilityLimit)
            : "",
      });
    } else if (type === "travel") {
      setTravel({
        tripType: String(d.tripType ?? "") as TravelPolicy["tripType"],
        destination:
          (d.destination as string[]) ||
          (d.destination ? [String(d.destination)] : []),
        tripStartDate: String(d.tripStartDate ?? ""),
        tripEndDate: String(d.tripEndDate ?? ""),
        numberOfTravelers:
          d.numberOfTravelers != null ? String(d.numberOfTravelers) : "1",
        travelers: (d.travelers as any[])?.map((t) => ({
          name: String(t?.name ?? ""),
          age: t?.age != null ? String(t.age) : "",
          relationship: String(t?.relationship ?? ""),
        })) || [{ name: "", age: "", relationship: "" }],
        visaType: String(d.visaType ?? ""),
        preExistingConditions: String(d.preExistingConditions ?? ""),
        activitiesCovered:
          (d.activitiesCovered as string[]) ||
          (d.activitiesCovered ? [String(d.activitiesCovered)] : []),
        coverageAmount:
          d.coverageAmount != null ? String(d.coverageAmount) : "",
        coverageType: String(
          d.coverageType ?? "",
        ) as TravelPolicy["coverageType"],
      });
    }

    setWasExtracted(true);
    setExtractionConfidence(
      typeof data.confidence === "number" ? data.confidence : 100,
    );
    setErrors({});
  }

  function isExtractionDataValid(
    data: unknown,
  ): data is Record<string, unknown> {
    if (!data || typeof data !== "object") return false;
    const record = data as Record<string, unknown>;
    const topLevelFields = [
      "customerName",
      "policyNumber",
      "premium",
      "sumInsured",
      "startDate",
      "endDate",
      "address",
      "email",
      "phone",
    ];
    if (
      topLevelFields.some((field) => {
        const value = record[field];
        return (
          value != null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0)
        );
      })
    ) {
      return true;
    }
    const details = record.details;
    if (details && typeof details === "object") {
      return Object.values(details as Record<string, unknown>).some(
        (value) =>
          value != null &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0),
      );
    }
    return false;
  }

  // ── Single-file extraction ────────────────────────────────────────────────
  async function handleFileSelected(file: File) {
    setFileError("");
    setExtractionError("");

    if (file.type !== "application/pdf") {
      setFileError("Please select a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File must be under 10 MB");
      return;
    }

    setSelectedFileName(file.name);
    setIsExtracting(true);
    setWasExtracted(false);
    setExtractionConfidence(100);

    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await fetch("/api/extract-policy", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();

      if (!res.ok || !isExtractionDataValid(body?.data)) {
        const msg =
          body?.message ||
          body?.error ||
          "Extraction failed — please try again or enter manually";
        setExtractionError(msg);
        setSelectedFileName("");
        // Reset the file input so the agent can re-select the same file
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Success — auto-fill
      autoFillForm(body.data as Record<string, unknown>);
    } catch {
      setExtractionError("Network error — check your connection and try again");
      setSelectedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsExtracting(false);
    }
  }

  // ── Mode toggle ───────────────────────────────────────────────────────────
  function handleModeSwitch(mode: "manual" | "pdf") {
    if (mode === entryMode) return;
    const hasData =
      Object.entries(base).some(([key, value]) => {
        if (key === "phoneCountryIso2") return false;
        return value !== "";
      }) || wasExtracted;
    if (hasData) {
      const msg =
        mode === "pdf"
          ? "Switching to PDF mode will clear your entered data. Continue?"
          : "Switching to manual mode will clear extracted data. Continue?";
      if (!window.confirm(msg)) return;
    }
    setBase(emptyBase());
    setMotor(emptyMotor());
    setMedical(emptyMedical());
    setFire(emptyFire());
    setLife(emptyLife());
    setPersonalAccident(emptyPersonalAccident());
    setMarine(emptyMarine());
    setWorkmanCompensation(emptyWorkmanCompensation());
    setErrors({});
    setWasExtracted(false);
    setExtractionConfidence(100);
    setFileError("");
    setExtractionError("");
    setSelectedFileName("");
    setIsExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEntryMode(mode);
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): Errors {
    const e: Errors = {};
    if (!base.customerName.trim()) e.customerName = "Required";
    if (!base.phone.trim()) e.phone = "Required";
    else if (!/^\d{6,15}$/.test(base.phone))
      e.phone = "Enter a valid contact number";
    if (base.email && !base.email.includes("@")) e.email = "Invalid email";
    if (!base.policyNumber.trim()) e.policyNumber = "Required";
    if (!base.premiumAmount || isNaN(Number(base.premiumAmount)))
      e.premiumAmount = "Enter a valid amount";
    if (!base.startDate) e.startDate = "Required";
    if (!base.endDate) e.endDate = "Required";
    if (base.startDate && base.endDate && base.endDate <= base.startDate)
      e.endDate = "End date must be after start date";
    if (selectedType === "motor") {
      if (!motor.vehicleMake?.toString().trim()) e.vehicleMake = "Required";
      if (!motor.vehicleModel?.toString().trim()) e.vehicleModel = "Required";
      if (!motor.registrationNumber?.toString().trim())
        e.registrationNumber = "Required";
    }
    if (selectedType === "medical") {
      if (!medical.dateOfBirth) e.dateOfBirth = "Required";
      if (!medical.gender) e.gender = "Required";
    }
    if (selectedType === "fire") {
      if (!fire.propertyType) e.propertyType = "Required";
      if (!fire.propertyAddress.trim()) e.propertyAddress = "Required";
    }
    if (selectedType === "life") {
      if (!life.dateOfBirth) e.dateOfBirth = "Required";
      if (!life.nomineeName.trim()) e.nomineeName = "Required";
      if (!life.lifePolicyType) e.lifePolicyType = "Required";
    }
    if (selectedType === "personal-accident") {
      if (!personalAccident.occupation.trim()) e.occupation = "Required";
      if (!personalAccident.nomineeName.trim()) e.nomineeName = "Required";
      if (!personalAccident.coverageType.trim()) e.coverageType = "Required";
    }
    if (selectedType === "marine") {
      if (!marine.marineInsuranceType.trim())
        e.marineInsuranceType = "Required";
      if (!marine.cargoType.trim()) e.cargoType = "Required";
      if (!marine.voyageFrom.trim()) e.voyageFrom = "Required";
      if (!marine.voyageTo.trim()) e.voyageTo = "Required";
    }
    if (selectedType === "workman-compensation") {
      if (!workmanCompensation.employeeCount.trim())
        e.employeeCount = "Required";
      if (!workmanCompensation.industryType.trim()) e.industryType = "Required";
      if (!workmanCompensation.coverageLocation.trim())
        e.coverageLocation = "Required";
    }
    if (selectedType === "travel") {
      if (!travel.tripType.trim()) e.tripType = "Required";
      if (!travel.tripStartDate.trim()) e.tripStartDate = "Required";
      if (!travel.tripEndDate.trim()) e.tripEndDate = "Required";
      if (!travel.coverageType.trim()) e.coverageType = "Required";
    }
    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError("");

    let details: Record<string, unknown> = {};
    if (selectedType === "motor") details = { ...motor };
    else if (selectedType === "medical") details = { ...medical };
    else if (selectedType === "fire") details = { ...fire };
    else if (selectedType === "life") details = { ...life };
    else if (selectedType === "personal-accident")
      details = { ...personalAccident };
    else if (selectedType === "marine") details = { ...marine };
    else if (selectedType === "workman-compensation")
      details = { ...workmanCompensation };
    else if (selectedType === "travel") details = { ...travel };

    const selectedCountry =
      COUNTRY_CALLING_CODES.find(
        (country) => country.iso2 === base.phoneCountryIso2,
      ) ?? COUNTRY_CALLING_CODES[0];
    const payload: Record<string, unknown> = {
      ...base,
      phone: `${selectedCountry.dialCode}${base.phone}`,
      type: selectedType,
      details,
    };
    delete payload.phoneCountryIso2;

    try {
      if (editId) {
        await updateCustomer(editId, payload);
        router.push(`/dashboard/customers/${editId}`);
      } else {
        const created = await saveCustomer(payload);
        router.push(`/dashboard/customers/${created._id}`);
      }
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save customer",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const upBase =
    (k: keyof typeof base) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const nextValue =
        k === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value;
      setBase((b) => ({ ...b, [k]: nextValue }));
      setErrors((err) => {
        const x = { ...err };
        delete x[k];
        return x;
      });
    };

  function syncMembers(count: string) {
    const n = Math.max(1, parseInt(count) || 1);
    setMedical((m) => {
      const members = [...m.members];
      while (members.length < n) members.push({ name: "", age: "" });
      while (members.length > n) members.pop();
      return { ...m, numberOfMembers: String(n), members };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Step 1 — Select type ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div>
        <div className="page-header">
          <div className="page-header-left">
            <h1>{editId ? "Edit Customer" : "Add New Customer"}</h1>
            <p>Step 1 of 2 — Select the insurance policy type</p>
          </div>
        </div>
        <div className="steps" style={{ maxWidth: 480, marginBottom: 36 }}>
          <div className="step active">
            <div className="step-dot">1</div>
            <span className="step-label">Select Type</span>
          </div>
          <div className="step-line" />
          <div className="step">
            <div className="step-dot">2</div>
            <span className="step-label">Fill Details</span>
          </div>
        </div>
        <div className="type-grid">
          {typeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedType === opt.type;
            return (
              <button
                key={opt.type}
                className={`type-card ${isSelected ? `selected-${opt.type}` : ""}`}
                onClick={() => setSelectedType(opt.type)}
                id={`type-${opt.type}`}
              >
                <div
                  className="type-card-icon"
                  style={{ background: opt.bg, color: opt.color }}
                >
                  <Icon size={26} />
                </div>
                <div className="type-card-label">{opt.label}</div>
                <div className="type-card-desc">{opt.desc}</div>
                {isSelected && (
                  <div style={{ color: opt.color }}>
                    <Check size={18} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            maxWidth: 640,
            margin: "32px auto 0",
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => router.push("/dashboard/customers")}
          >
            <X size={15} /> Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!selectedType}
            onClick={() => selectedType && setStep(2)}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Step 2 — Fill details ────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{editId ? "Edit Customer" : "Add New Customer"}</h1>
          <p>Step 2 of 2 — Fill in customer &amp; policy details</p>
        </div>
      </div>
      <div className="steps" style={{ maxWidth: 480, marginBottom: 32 }}>
        <div className="step done">
          <div className="step-dot">
            <Check size={14} />
          </div>
          <span className="step-label">Select Type</span>
        </div>
        <div className="step-line done" />
        <div className="step active">
          <div className="step-dot">2</div>
          <span className="step-label">Fill Details</span>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {/* ── Mode toggle ─────────────────────────────────────────── */}
          {!editId && (
            <div
              style={{
                display: "flex",
                gap: 0,
                marginBottom: 24,
                borderRadius: "var(--radius)",
                border: "1.5px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <button
                id="mode-manual"
                onClick={() => handleModeSwitch("manual")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  border: "none",
                  cursor: "pointer",
                  transition: "all .15s ease",
                  background:
                    entryMode === "manual"
                      ? "var(--primary)"
                      : "var(--surface)",
                  color: entryMode === "manual" ? "#fff" : "var(--text-muted)",
                }}
              >
                ✎ Enter Manually
              </button>
              <div style={{ width: 1, background: "var(--border)" }} />
              <button
                id="mode-pdf"
                onClick={() => handleModeSwitch("pdf")}
                disabled={isExtracting}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  border: "none",
                  cursor: isExtracting ? "not-allowed" : "pointer",
                  transition: "all .15s ease",
                  background:
                    entryMode === "pdf" ? "var(--primary)" : "var(--surface)",
                  color: entryMode === "pdf" ? "#fff" : "var(--text-muted)",
                }}
              >
                <Upload size={15} /> Upload Policy PDF
              </button>
            </div>
          )}

          {/* ── Single-file PDF upload zone ──────────────────────── */}
          {entryMode === "pdf" && (
            <div style={{ marginBottom: 20 }}>
              {/* Drop zone — hidden once extraction is in progress */}
              {!isExtracting && !wasExtracted && (
                <>
                  <div
                    id="pdf-drop-zone"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                    onClick={() => {
                      if (!isExtracting) fileInputRef.current?.click();
                    }}
                    style={{
                      border: `2px dashed ${isDragging ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: "var(--radius-lg)",
                      padding: "36px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: isDragging
                        ? "var(--primary-light)"
                        : "var(--bg)",
                      transition: "all .15s ease",
                      marginBottom: 10,
                    }}
                  >
                    <Upload
                      size={30}
                      style={{
                        color: "var(--primary)",
                        display: "block",
                        margin: "0 auto 12px",
                      }}
                    />
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: "var(--text)",
                        marginBottom: 4,
                      }}
                    >
                      Drop a PDF here or click to browse
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      One file at a time &nbsp;•&nbsp; Max 10 MB
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                  />
                </>
              )}

              {/* Validation error (wrong file type / too large) */}
              {fileError && (
                <div
                  style={{
                    background: "var(--status-expired-bg)",
                    border: "1px solid #f7b8b8",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: 12.5,
                    color: "var(--status-expired)",
                    marginBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={14} /> {fileError}
                </div>
              )}

              {/* Extraction in progress */}
              {isExtracting && (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "28px 24px",
                    textAlign: "center",
                    background: "var(--surface)",
                    marginBottom: 10,
                  }}
                >
                  <Loader2
                    size={32}
                    style={{
                      color: "var(--primary)",
                      display: "block",
                      margin: "0 auto 14px",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--text)",
                      marginBottom: 4,
                    }}
                  >
                    Extracting policy details…
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {selectedFileName}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--text-muted)",
                      marginTop: 6,
                    }}
                  >
                    Please wait — this usually takes 3–6 seconds
                  </div>
                </div>
              )}

              {/* Extraction failure — inline error + reset */}
              {extractionError && !isExtracting && (
                <div
                  style={{
                    background: "var(--status-expired-bg)",
                    border: "1px solid #f7b8b8",
                    borderRadius: "var(--radius)",
                    padding: "14px 16px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <AlertCircle
                      size={16}
                      style={{
                        color: "var(--status-expired)",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "var(--status-expired)",
                          marginBottom: 2,
                        }}
                      >
                        Extraction failed
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--status-expired)",
                        }}
                      >
                        {extractionError}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setExtractionError("");
                      setSelectedFileName("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    style={{ fontSize: 12 }}
                  >
                    Try another file
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Confidence / success banner ──────────────────────────── */}
          {wasExtracted && (
            <div
              style={{
                borderRadius: "var(--radius)",
                padding: "12px 16px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13.5,
                fontWeight: 500,
                background:
                  extractionConfidence >= 80
                    ? "#e4f5ec"
                    : extractionConfidence >= 60
                      ? "var(--status-expiring-bg)"
                      : "var(--status-expired-bg)",
                border: `1px solid ${
                  extractionConfidence >= 80
                    ? "#a7e3be"
                    : extractionConfidence >= 60
                      ? "var(--fire-border)"
                      : "#f7b8b8"
                }`,
                color:
                  extractionConfidence >= 80
                    ? "var(--status-active)"
                    : extractionConfidence >= 60
                      ? "var(--status-expiring)"
                      : "var(--status-expired)",
              }}
            >
              {extractionConfidence >= 80 ? (
                <CheckCircle2 size={16} />
              ) : extractionConfidence >= 60 ? (
                <AlertTriangle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              {extractionConfidence >= 80 &&
                "Details extracted from PDF — review before saving"}
              {extractionConfidence >= 60 &&
                extractionConfidence < 80 &&
                "Low confidence extraction — verify all fields carefully"}
              {extractionConfidence < 60 &&
                "Very low confidence — please verify everything. Policy type may be incorrect."}
              <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>
                Confidence: {extractionConfidence}%
              </span>
            </div>
          )}

          {/* ── Customer Information ─────────────────────────────────── */}
          <div className="form-section">
            <div className="form-section-title">👤 Customer Information</div>
            <div className="form-grid">
              <Field
                label="Customer Name"
                name="customerName"
                required
                error={errors.customerName}
              >
                <input
                  id="customerName"
                  className={`form-control ${errors.customerName ? "error" : ""}`}
                  value={base.customerName}
                  onChange={upBase("customerName")}
                  placeholder="Full name"
                />
              </Field>
              <Field
                label="Phone Number"
                name="phone"
                required
                error={errors.phone}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(130px, 180px) minmax(0, 1fr)",
                    gap: 10,
                  }}
                >
                  <select
                    id="phoneCountryIso2"
                    className="form-control"
                    value={base.phoneCountryIso2}
                    onChange={upBase("phoneCountryIso2")}
                  >
                    {COUNTRY_CALLING_CODES.map((country) => (
                      <option key={country.iso2} value={country.iso2}>
                        {country.name} (+{country.dialCode})
                      </option>
                    ))}
                  </select>
                  <input
                    id="phone"
                    className={`form-control ${errors.phone ? "error" : ""}`}
                    value={base.phone}
                    onChange={upBase("phone")}
                    placeholder="Contact number"
                    inputMode="numeric"
                  />
                </div>
              </Field>
              <Field label="Email" name="email" error={errors.email}>
                <input
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? "error" : ""}`}
                  value={base.email}
                  onChange={upBase("email")}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Address" name="address">
                <textarea
                  id="address"
                  className="form-control"
                  rows={2}
                  value={base.address}
                  onChange={upBase("address")}
                  placeholder="Full address"
                />
              </Field>
            </div>
          </div>

          {/* ── Motor ──────────────────────────────────────────────────── */}
          {selectedType === "motor" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--motor)" }}
              >
                🚗 Vehicle Details
              </div>
              <div className="form-grid">
                <Field
                  label="Vehicle Make"
                  name="vehicleMake"
                  required
                  error={errors.vehicleMake}
                >
                  <input
                    id="vehicleMake"
                    className={`form-control ${errors.vehicleMake ? "error" : ""}`}
                    value={String(motor.vehicleMake ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, vehicleMake: e.target.value }))
                    }
                    placeholder="e.g. Maruti Suzuki"
                  />
                </Field>
                <Field
                  label="Vehicle Model"
                  name="vehicleModel"
                  required
                  error={errors.vehicleModel}
                >
                  <input
                    id="vehicleModel"
                    className={`form-control ${errors.vehicleModel ? "error" : ""}`}
                    value={String(motor.vehicleModel ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, vehicleModel: e.target.value }))
                    }
                    placeholder="e.g. Swift Dzire"
                  />
                </Field>
                <Field label="Vehicle Year" name="vehicleYear">
                  <input
                    id="vehicleYear"
                    className="form-control"
                    value={String(motor.vehicleYear ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, vehicleYear: e.target.value }))
                    }
                    placeholder="e.g. 2021"
                    maxLength={4}
                  />
                </Field>
                <Field
                  label="Registration Number"
                  name="registrationNumber"
                  required
                  error={errors.registrationNumber}
                >
                  <input
                    id="registrationNumber"
                    className={`form-control ${errors.registrationNumber ? "error" : ""}`}
                    value={String(motor.registrationNumber ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({
                        ...m,
                        registrationNumber: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. MH12AB1234"
                  />
                </Field>
                <Field label="Engine CC" name="engineCC">
                  <input
                    id="engineCC"
                    className="form-control"
                    value={String(motor.engineCC ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, engineCC: e.target.value }))
                    }
                    placeholder="e.g. 1200"
                  />
                </Field>
                <Field label="Fuel Type" name="fuelType">
                  <select
                    id="fuelType"
                    className="form-control"
                    value={String(motor.fuelType ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({
                        ...m,
                        fuelType: e.target.value as typeof motor.fuelType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Petrol</option>
                    <option>Diesel</option>
                    <option>CNG</option>
                    <option>Electric</option>
                  </select>
                </Field>
                <Field label="IDV Value (₹)" name="idvValue">
                  <input
                    id="idvValue"
                    className="form-control"
                    value={String(motor.idvValue ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, idvValue: e.target.value }))
                    }
                    placeholder="Insured Declared Value"
                  />
                </Field>
                <Field label="NCB (%)" name="ncbPercent">
                  <input
                    id="ncbPercent"
                    className="form-control"
                    value={String(motor.ncbPercent ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, ncbPercent: e.target.value }))
                    }
                    placeholder="No Claim Bonus %"
                  />
                </Field>
                <Field label="Add-ons" name="addOns">
                  <input
                    id="addOns"
                    className="form-control"
                    value={String(motor.addOns ?? "")}
                    onChange={(e) =>
                      setMotor((m) => ({ ...m, addOns: e.target.value }))
                    }
                    placeholder="Zero Dep, Roadside Assistance…"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Medical ────────────────────────────────────────────────── */}
          {selectedType === "medical" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--medical)" }}
              >
                🏥 Health Details
              </div>
              <div className="form-grid">
                <Field
                  label="Date of Birth"
                  name="dateOfBirth"
                  required
                  error={errors.dateOfBirth}
                >
                  <input
                    id="dateOfBirth"
                    type="date"
                    className={`form-control ${errors.dateOfBirth ? "error" : ""}`}
                    value={medical.dateOfBirth}
                    onChange={(e) => {
                      const dob = e.target.value;
                      setMedical((m) => ({
                        ...m,
                        dateOfBirth: dob,
                        age: dob ? String(calculateAge(dob)) : "",
                      }));
                    }}
                  />
                </Field>
                <Field label="Age" name="age">
                  <input
                    id="age"
                    className="form-control"
                    readOnly
                    value={medical.age}
                    placeholder="Auto-calculated"
                  />
                </Field>
                <Field
                  label="Gender"
                  name="gender"
                  required
                  error={errors.gender}
                >
                  <select
                    id="gender"
                    className={`form-control ${errors.gender ? "error" : ""}`}
                    value={medical.gender}
                    onChange={(e) =>
                      setMedical((m) => ({
                        ...m,
                        gender: e.target.value as typeof medical.gender,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Blood Group" name="bloodGroup">
                  <select
                    id="bloodGroup"
                    className="form-control"
                    value={medical.bloodGroup}
                    onChange={(e) =>
                      setMedical((m) => ({ ...m, bloodGroup: e.target.value }))
                    }
                  >
                    <option value="">Select</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>O+</option>
                    <option>O-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                  </select>
                </Field>
                <Field label="Smoker" name="smoker">
                  <select
                    id="smoker"
                    className="form-control"
                    value={medical.smoker}
                    onChange={(e) =>
                      setMedical((m) => ({
                        ...m,
                        smoker: e.target.value as typeof medical.smoker,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </Field>
                <Field
                  label="Pre-existing Conditions"
                  name="preExistingConditions"
                >
                  <input
                    id="preExistingConditions"
                    className="form-control"
                    value={medical.preExistingConditions}
                    onChange={(e) =>
                      setMedical((m) => ({
                        ...m,
                        preExistingConditions: e.target.value,
                      }))
                    }
                    placeholder="Diabetes, Hypertension…"
                  />
                </Field>
                <Field
                  label="Cashless Hospital Network"
                  name="cashlessHospitalNetwork"
                >
                  <input
                    id="cashlessHospitalNetwork"
                    className="form-control"
                    value={medical.cashlessHospitalNetwork}
                    onChange={(e) =>
                      setMedical((m) => ({
                        ...m,
                        cashlessHospitalNetwork: e.target.value,
                      }))
                    }
                    placeholder="e.g. Apollo, Fortis network"
                  />
                </Field>
                <div className="form-group full-width">
                  <label className="form-label">Number of Members</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={10}
                    value={medical.numberOfMembers}
                    onChange={(e) => syncMembers(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                {medical.members.map((mem, i) => (
                  <div
                    key={i}
                    className="member-row"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <span className="member-row-num">#{i + 1}</span>
                    <input
                      className="form-control"
                      placeholder={`Member ${i + 1} name`}
                      value={mem.name}
                      onChange={(e) => {
                        const updated = [...medical.members];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setMedical((x) => ({ ...x, members: updated }));
                      }}
                    />
                    <input
                      className="form-control"
                      placeholder="Age"
                      maxLength={3}
                      style={{ maxWidth: 80 }}
                      value={mem.age}
                      onChange={(e) => {
                        const updated = [...medical.members];
                        updated[i] = { ...updated[i], age: e.target.value };
                        setMedical((x) => ({ ...x, members: updated }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Fire ───────────────────────────────────────────────────── */}
          {selectedType === "fire" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--fire)" }}
              >
                🏠 Property Details
              </div>
              <div className="form-grid">
                <Field
                  label="Property Type"
                  name="propertyType"
                  required
                  error={errors.propertyType}
                >
                  <select
                    id="propertyType"
                    className={`form-control ${errors.propertyType ? "error" : ""}`}
                    value={fire.propertyType}
                    onChange={(e) =>
                      setFire((f) => ({
                        ...f,
                        propertyType: e.target
                          .value as typeof fire.propertyType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Industrial</option>
                  </select>
                </Field>
                <Field label="Construction Type" name="constructionType">
                  <select
                    id="constructionType"
                    className="form-control"
                    value={fire.constructionType}
                    onChange={(e) =>
                      setFire((f) => ({
                        ...f,
                        constructionType: e.target
                          .value as typeof fire.constructionType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>RCC</option>
                    <option>Wood</option>
                    <option>Mixed</option>
                  </select>
                </Field>
                <Field label="Built-up Area (sq ft)" name="builtUpArea">
                  <input
                    id="builtUpArea"
                    className="form-control"
                    value={fire.builtUpArea}
                    onChange={(e) =>
                      setFire((f) => ({ ...f, builtUpArea: e.target.value }))
                    }
                    placeholder="e.g. 1200"
                  />
                </Field>
                <Field label="Property Value (₹)" name="propertyValue">
                  <input
                    id="propertyValue"
                    className="form-control"
                    value={fire.propertyValue}
                    onChange={(e) =>
                      setFire((f) => ({ ...f, propertyValue: e.target.value }))
                    }
                    placeholder="Market value"
                  />
                </Field>
                <Field label="Stock Value (₹)" name="stockValue">
                  <input
                    id="stockValue"
                    className="form-control"
                    value={fire.stockValue}
                    onChange={(e) =>
                      setFire((f) => ({ ...f, stockValue: e.target.value }))
                    }
                    placeholder="If commercial"
                  />
                </Field>
                <Field
                  label="Property Address"
                  name="propertyAddress"
                  required
                  error={errors.propertyAddress}
                >
                  <textarea
                    id="propertyAddress"
                    className={`form-control ${errors.propertyAddress ? "error" : ""}`}
                    rows={2}
                    value={fire.propertyAddress}
                    onChange={(e) =>
                      setFire((f) => ({
                        ...f,
                        propertyAddress: e.target.value,
                      }))
                    }
                    placeholder="Full property address"
                  />
                </Field>
                <Field label="Risk Location" name="riskLocation">
                  <input
                    id="riskLocation"
                    className="form-control"
                    value={fire.riskLocation}
                    onChange={(e) =>
                      setFire((f) => ({ ...f, riskLocation: e.target.value }))
                    }
                    placeholder="City / Zone"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ── Life ───────────────────────────────────────────────────── */}
          {selectedType === "life" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--life)" }}
              >
                💼 Life Policy Details
              </div>
              <div className="form-grid">
                <Field
                  label="Date of Birth"
                  name="dateOfBirth"
                  required
                  error={errors.dateOfBirth}
                >
                  <input
                    id="dateOfBirth"
                    type="date"
                    className={`form-control ${errors.dateOfBirth ? "error" : ""}`}
                    value={life.dateOfBirth}
                    onChange={(e) => {
                      const dob = e.target.value;
                      setLife((l) => ({
                        ...l,
                        dateOfBirth: dob,
                        age: dob ? String(calculateAge(dob)) : "",
                      }));
                    }}
                  />
                </Field>
                <Field label="Age" name="age">
                  <input
                    id="age"
                    className="form-control"
                    readOnly
                    value={life.age}
                    placeholder="Auto-calculated"
                  />
                </Field>
                <Field label="Gender" name="gender">
                  <select
                    id="gender"
                    className="form-control"
                    value={life.gender}
                    onChange={(e) =>
                      setLife((l) => ({
                        ...l,
                        gender: e.target.value as typeof life.gender,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Occupation" name="occupation">
                  <input
                    id="occupation"
                    className="form-control"
                    value={life.occupation}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, occupation: e.target.value }))
                    }
                    placeholder="e.g. Engineer"
                  />
                </Field>
                <Field label="Annual Income (₹)" name="annualIncome">
                  <input
                    id="annualIncome"
                    className="form-control"
                    value={life.annualIncome}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, annualIncome: e.target.value }))
                    }
                    placeholder="Annual income"
                  />
                </Field>
                <Field label="Smoker" name="smoker">
                  <select
                    id="smoker"
                    className="form-control"
                    value={life.smoker}
                    onChange={(e) =>
                      setLife((l) => ({
                        ...l,
                        smoker: e.target.value as typeof life.smoker,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </Field>
                <Field
                  label="Nominee Name"
                  name="nomineeName"
                  required
                  error={errors.nomineeName}
                >
                  <input
                    id="nomineeName"
                    className={`form-control ${errors.nomineeName ? "error" : ""}`}
                    value={life.nomineeName}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, nomineeName: e.target.value }))
                    }
                    placeholder="Nominee full name"
                  />
                </Field>
                <Field label="Nominee Relation" name="nomineeRelation">
                  <input
                    id="nomineeRelation"
                    className="form-control"
                    value={life.nomineeRelation}
                    onChange={(e) =>
                      setLife((l) => ({
                        ...l,
                        nomineeRelation: e.target.value,
                      }))
                    }
                    placeholder="e.g. Spouse, Child"
                  />
                </Field>
                <Field
                  label="Policy Type"
                  name="lifePolicyType"
                  required
                  error={errors.lifePolicyType}
                >
                  <select
                    id="lifePolicyType"
                    className={`form-control ${errors.lifePolicyType ? "error" : ""}`}
                    value={life.lifePolicyType}
                    onChange={(e) =>
                      setLife((l) => ({
                        ...l,
                        lifePolicyType: e.target
                          .value as typeof life.lifePolicyType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Term</option>
                    <option>Endowment</option>
                    <option>ULIP</option>
                    <option>Money Back</option>
                  </select>
                </Field>
                <Field label="Sum Assured (₹)" name="sumAssured">
                  <input
                    id="sumAssured"
                    className="form-control"
                    value={life.sumAssured}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, sumAssured: e.target.value }))
                    }
                    placeholder="Sum assured"
                  />
                </Field>
                <Field label="Premium Frequency" name="premiumFrequency">
                  <select
                    id="premiumFrequency"
                    className="form-control"
                    value={life.premiumFrequency}
                    onChange={(e) =>
                      setLife((l) => ({
                        ...l,
                        premiumFrequency: e.target
                          .value as typeof life.premiumFrequency,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                    <option>Annual</option>
                  </select>
                </Field>
                <Field label="Policy Term (Years)" name="policyTerm">
                  <input
                    id="policyTerm"
                    className="form-control"
                    value={life.policyTerm}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, policyTerm: e.target.value }))
                    }
                    placeholder="e.g. 20"
                  />
                </Field>
                <Field label="Maturity Date" name="maturityDate">
                  <input
                    id="maturityDate"
                    type="date"
                    className="form-control"
                    value={life.maturityDate}
                    onChange={(e) =>
                      setLife((l) => ({ ...l, maturityDate: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </div>
          )}

          {selectedType === "personal-accident" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--personal-accident)" }}
              >
                🛡️ Personal Accident Details
              </div>
              <div className="form-grid">
                <Field
                  label="Occupation"
                  name="occupation"
                  required
                  error={errors.occupation}
                >
                  <input
                    id="occupation"
                    className={`form-control ${errors.occupation ? "error" : ""}`}
                    value={personalAccident.occupation}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        occupation: e.target.value,
                      }))
                    }
                    placeholder="Occupation / profession"
                  />
                </Field>
                <Field
                  label="Coverage Type"
                  name="coverageType"
                  required
                  error={errors.coverageType}
                >
                  <input
                    id="coverageType"
                    className={`form-control ${errors.coverageType ? "error" : ""}`}
                    value={personalAccident.coverageType}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        coverageType: e.target.value,
                      }))
                    }
                    placeholder="Individual, family, group…"
                  />
                </Field>
                <Field label="Disability Cover" name="disabilityCover">
                  <input
                    id="disabilityCover"
                    className="form-control"
                    value={personalAccident.disabilityCover}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        disabilityCover: e.target.value,
                      }))
                    }
                    placeholder="Permanent / partial disability details"
                  />
                </Field>
                <Field label="Risk Class" name="riskClass">
                  <input
                    id="riskClass"
                    className="form-control"
                    value={personalAccident.riskClass}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        riskClass: e.target.value,
                      }))
                    }
                    placeholder="Low, medium, high…"
                  />
                </Field>
                <Field
                  label="Nominee Name"
                  name="nomineeName"
                  required
                  error={errors.nomineeName}
                >
                  <input
                    id="nomineeName"
                    className={`form-control ${errors.nomineeName ? "error" : ""}`}
                    value={personalAccident.nomineeName}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        nomineeName: e.target.value,
                      }))
                    }
                    placeholder="Nominee full name"
                  />
                </Field>
                <Field label="Nominee Relation" name="nomineeRelation">
                  <input
                    id="nomineeRelation"
                    className="form-control"
                    value={personalAccident.nomineeRelation}
                    onChange={(e) =>
                      setPersonalAccident((p) => ({
                        ...p,
                        nomineeRelation: e.target.value,
                      }))
                    }
                    placeholder="Spouse, parent, sibling…"
                  />
                </Field>
              </div>
            </div>
          )}

          {selectedType === "marine" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--marine)" }}
              >
                🚢 Marine Insurance Details
              </div>
              <div className="form-grid">
                <Field
                  label="Insurance Type"
                  name="marineInsuranceType"
                  required
                  error={errors.marineInsuranceType}
                >
                  <input
                    id="marineInsuranceType"
                    className={`form-control ${errors.marineInsuranceType ? "error" : ""}`}
                    value={marine.marineInsuranceType}
                    onChange={(e) =>
                      setMarine((m) => ({
                        ...m,
                        marineInsuranceType: e.target.value,
                      }))
                    }
                    placeholder="Marine cargo, inland transit…"
                  />
                </Field>
                <Field
                  label="Cargo Type"
                  name="cargoType"
                  required
                  error={errors.cargoType}
                >
                  <input
                    id="cargoType"
                    className={`form-control ${errors.cargoType ? "error" : ""}`}
                    value={marine.cargoType}
                    onChange={(e) =>
                      setMarine((m) => ({ ...m, cargoType: e.target.value }))
                    }
                    placeholder="Machinery, FMCG, raw material…"
                  />
                </Field>
                <Field
                  label="Voyage From"
                  name="voyageFrom"
                  required
                  error={errors.voyageFrom}
                >
                  <input
                    id="voyageFrom"
                    className={`form-control ${errors.voyageFrom ? "error" : ""}`}
                    value={marine.voyageFrom}
                    onChange={(e) =>
                      setMarine((m) => ({ ...m, voyageFrom: e.target.value }))
                    }
                    placeholder="Origin location"
                  />
                </Field>
                <Field
                  label="Voyage To"
                  name="voyageTo"
                  required
                  error={errors.voyageTo}
                >
                  <input
                    id="voyageTo"
                    className={`form-control ${errors.voyageTo ? "error" : ""}`}
                    value={marine.voyageTo}
                    onChange={(e) =>
                      setMarine((m) => ({ ...m, voyageTo: e.target.value }))
                    }
                    placeholder="Destination location"
                  />
                </Field>
                <Field label="Transit Mode" name="transitMode">
                  <input
                    id="transitMode"
                    className="form-control"
                    value={marine.transitMode}
                    onChange={(e) =>
                      setMarine((m) => ({ ...m, transitMode: e.target.value }))
                    }
                    placeholder="Sea, road, rail, air…"
                  />
                </Field>
                <Field label="Vessel / Carrier Name" name="vesselName">
                  <input
                    id="vesselName"
                    className="form-control"
                    value={marine.vesselName}
                    onChange={(e) =>
                      setMarine((m) => ({ ...m, vesselName: e.target.value }))
                    }
                    placeholder="Ship or carrier name"
                  />
                </Field>
              </div>
            </div>
          )}

          {selectedType === "workman-compensation" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--workman-compensation)" }}
              >
                👷 Workman Compensation Details
              </div>
              <div className="form-grid">
                <Field
                  label="Employee Count"
                  name="employeeCount"
                  required
                  error={errors.employeeCount}
                >
                  <input
                    id="employeeCount"
                    className={`form-control ${errors.employeeCount ? "error" : ""}`}
                    value={workmanCompensation.employeeCount}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        employeeCount: e.target.value,
                      }))
                    }
                    placeholder="Number of employees covered"
                  />
                </Field>
                <Field
                  label="Industry Type"
                  name="industryType"
                  required
                  error={errors.industryType}
                >
                  <input
                    id="industryType"
                    className={`form-control ${errors.industryType ? "error" : ""}`}
                    value={workmanCompensation.industryType}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        industryType: e.target.value,
                      }))
                    }
                    placeholder="Construction, factory, warehouse…"
                  />
                </Field>
                <Field label="Total Wages" name="totalWages">
                  <input
                    id="totalWages"
                    className="form-control"
                    value={workmanCompensation.totalWages}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        totalWages: e.target.value,
                      }))
                    }
                    placeholder="Total wages declared"
                  />
                </Field>
                <Field label="Risk Category" name="riskCategory">
                  <input
                    id="riskCategory"
                    className="form-control"
                    value={workmanCompensation.riskCategory}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        riskCategory: e.target.value,
                      }))
                    }
                    placeholder="Low, medium, high…"
                  />
                </Field>
                <Field
                  label="Coverage Location"
                  name="coverageLocation"
                  required
                  error={errors.coverageLocation}
                >
                  <input
                    id="coverageLocation"
                    className={`form-control ${errors.coverageLocation ? "error" : ""}`}
                    value={workmanCompensation.coverageLocation}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        coverageLocation: e.target.value,
                      }))
                    }
                    placeholder="Factory / site / office location"
                  />
                </Field>
                <Field
                  label="Employer Liability Limit"
                  name="employerLiabilityLimit"
                >
                  <input
                    id="employerLiabilityLimit"
                    className="form-control"
                    value={workmanCompensation.employerLiabilityLimit}
                    onChange={(e) =>
                      setWorkmanCompensation((w) => ({
                        ...w,
                        employerLiabilityLimit: e.target.value,
                      }))
                    }
                    placeholder="Liability limit amount"
                  />
                </Field>
              </div>
            </div>
          )}

          {selectedType === "travel" && (
            <div className="form-section">
              <div
                className="form-section-title"
                style={{ color: "var(--travel)" }}
              >
                ✈️ Travel Insurance Details
              </div>
              <div className="form-grid">
                <Field
                  label="Trip Type"
                  name="tripType"
                  required
                  error={errors.tripType}
                >
                  <select
                    id="tripType"
                    className={`form-control ${errors.tripType ? "error" : ""}`}
                    value={travel.tripType || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        tripType: e.target.value as typeof travel.tripType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Domestic</option>
                    <option>International</option>
                  </select>
                </Field>
                <Field label="Visa Type" name="visaType">
                  <input
                    id="visaType"
                    className="form-control"
                    value={travel.visaType || ""}
                    onChange={(e) =>
                      setTravel((t) => ({ ...t, visaType: e.target.value }))
                    }
                    placeholder="e.g. Tourist, Business, Student"
                  />
                </Field>
                <Field
                  label="Trip Start Date"
                  name="tripStartDate"
                  required
                  error={errors.tripStartDate}
                >
                  <input
                    id="tripStartDate"
                    type="date"
                    className={`form-control ${errors.tripStartDate ? "error" : ""}`}
                    value={travel.tripStartDate || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        tripStartDate: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Trip End Date"
                  name="tripEndDate"
                  required
                  error={errors.tripEndDate}
                >
                  <input
                    id="tripEndDate"
                    type="date"
                    className={`form-control ${errors.tripEndDate ? "error" : ""}`}
                    value={travel.tripEndDate || ""}
                    onChange={(e) =>
                      setTravel((t) => ({ ...t, tripEndDate: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Coverage Type"
                  name="coverageType"
                  required
                  error={errors.coverageType}
                >
                  <select
                    id="coverageType"
                    className={`form-control ${errors.coverageType ? "error" : ""}`}
                    value={travel.coverageType || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        coverageType: e.target
                          .value as typeof travel.coverageType,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option>Trip Cancellation</option>
                    <option>Medical</option>
                    <option>Baggage Loss</option>
                    <option>All-Risk</option>
                  </select>
                </Field>
                <Field label="Coverage Amount" name="coverageAmount">
                  <input
                    id="coverageAmount"
                    className="form-control"
                    value={travel.coverageAmount || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        coverageAmount: e.target.value,
                      }))
                    }
                    placeholder="e.g. $100,000"
                  />
                </Field>
                <Field label="Destinations" name="destination">
                  <input
                    id="destination"
                    className="form-control"
                    value={travel.destination?.join?.(", ") || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        destination: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g. France, Germany (comma-separated)"
                  />
                </Field>
                <Field label="Activities Covered" name="activitiesCovered">
                  <input
                    id="activitiesCovered"
                    className="form-control"
                    value={travel.activitiesCovered?.join?.(", ") || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        activitiesCovered: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                    placeholder="e.g. Skiing, Hiking (comma-separated)"
                  />
                </Field>
                <Field
                  label="Pre-Existing Conditions"
                  name="preExistingConditions"
                >
                  <input
                    id="preExistingConditions"
                    className="form-control"
                    value={travel.preExistingConditions || ""}
                    onChange={(e) =>
                      setTravel((t) => ({
                        ...t,
                        preExistingConditions: e.target.value,
                      }))
                    }
                    placeholder="e.g. Asthma, Diabetes"
                  />
                </Field>

                {/* Travelers Array */}
                <div className="form-group full-width">
                  <label className="form-label">Number of Travelers</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={10}
                    value={travel.numberOfTravelers || "1"}
                    onChange={(e) => {
                      const count = Math.max(
                        1,
                        Math.min(10, parseInt(e.target.value) || 1),
                      );
                      const newTravelers = [...travel.travelers];
                      while (newTravelers.length < count)
                        newTravelers.push({
                          name: "",
                          age: "",
                          relationship: "",
                        });
                      while (newTravelers.length > count) newTravelers.pop();
                      setTravel((t) => ({
                        ...t,
                        numberOfTravelers: String(count),
                        travelers: newTravelers,
                      }));
                    }}
                    style={{ maxWidth: 120 }}
                  />
                </div>
                {travel.travelers.map((trr, i) => (
                  <div
                    key={i}
                    className="member-row"
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: "30px 1fr 80px 1fr",
                      gap: "10px",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span className="member-row-num">#{i + 1}</span>
                    <input
                      className="form-control"
                      placeholder={`Traveler ${i + 1} name`}
                      value={trr.name || ""}
                      onChange={(e) => {
                        const updated = [...travel.travelers];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setTravel((x) => ({ ...x, travelers: updated }));
                      }}
                    />
                    <input
                      className="form-control"
                      placeholder="Age"
                      maxLength={3}
                      value={trr.age || ""}
                      onChange={(e) => {
                        const updated = [...travel.travelers];
                        updated[i] = { ...updated[i], age: e.target.value };
                        setTravel((x) => ({ ...x, travelers: updated }));
                      }}
                    />
                    <input
                      className="form-control"
                      placeholder="Relationship"
                      value={trr.relationship || ""}
                      onChange={(e) => {
                        const updated = [...travel.travelers];
                        updated[i] = {
                          ...updated[i],
                          relationship: e.target.value,
                        };
                        setTravel((x) => ({ ...x, travelers: updated }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Policy Information ──────────────────────────────────────── */}
          <div className="form-section">
            <div className="form-section-title">📋 Policy Information</div>
            <div className="form-grid">
              <Field
                label="Policy Number"
                name="policyNumber"
                required
                error={errors.policyNumber}
              >
                <input
                  id="policyNumber"
                  className={`form-control ${errors.policyNumber ? "error" : ""}`}
                  value={base.policyNumber}
                  onChange={upBase("policyNumber")}
                  placeholder="Policy/Certificate number"
                />
              </Field>
              <Field label="Sum Insured (₹)" name="sumInsured">
                <input
                  id="sumInsured"
                  className="form-control"
                  value={base.sumInsured}
                  onChange={upBase("sumInsured")}
                  placeholder="Total sum insured"
                />
              </Field>
              <Field
                label="Premium Amount (₹)"
                name="premiumAmount"
                required
                error={errors.premiumAmount}
              >
                <input
                  id="premiumAmount"
                  className={`form-control ${errors.premiumAmount ? "error" : ""}`}
                  value={base.premiumAmount}
                  onChange={upBase("premiumAmount")}
                  placeholder="Annual premium"
                />
              </Field>
              <Field
                label="Policy Start Date"
                name="startDate"
                required
                error={errors.startDate}
              >
                <input
                  id="startDate"
                  type="date"
                  className={`form-control ${errors.startDate ? "error" : ""}`}
                  value={base.startDate}
                  onChange={upBase("startDate")}
                />
              </Field>
              <Field
                label="Policy End Date"
                name="endDate"
                required
                error={errors.endDate}
              >
                <input
                  id="endDate"
                  type="date"
                  className={`form-control ${errors.endDate ? "error" : ""}`}
                  value={base.endDate}
                  onChange={upBase("endDate")}
                />
              </Field>
            </div>
          </div>

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              borderTop: "1px solid var(--border)",
              paddingTop: 20,
            }}
          >
            {!editId && (
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                <ChevronLeft size={15} /> Back
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => router.push("/dashboard/customers")}
              disabled={submitting || isExtracting}
            >
              <X size={15} /> Cancel
            </button>
            {submitError && (
              <span
                style={{
                  color: "var(--status-expired)",
                  fontSize: 13,
                  alignSelf: "center",
                }}
              >
                {submitError}
              </span>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              id="save-customer"
              disabled={submitting || isExtracting}
            >
              <Save size={15} />{" "}
              {submitting
                ? "Saving…"
                : editId
                  ? "Save Changes"
                  : "Save Customer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
