import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Trophy,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Scale
} from "lucide-react";

interface CodingChallenge {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  totalQuestions: number;
  completedQuestions?: number;
  tags: string[];
  xpReward: number;
  link?: string;
  rules?: string;
  termsAndConditions?: string;
  completed?: boolean;
}

interface ChallengeDetailsModalProps {
  challenge: CodingChallenge | null;
  isOpen: boolean;
  onClose: () => void;
  onStart: (challengeId: string) => void;
  onContinue: (challengeId: string) => void;
}

export default function ChallengeDetailsModal({
  challenge,
  isOpen,
  onClose,
  onStart,
  onContinue
}: ChallengeDetailsModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (!challenge) return null;

  const hasStarted = (challenge.completedQuestions || 0) > 0;
  const progressPercentage = challenge.totalQuestions > 0
    ? Math.round((challenge.completedQuestions || 0) / challenge.totalQuestions * 100)
    : 0;

  const handleStartClick = () => {
    if (challenge.termsAndConditions && !acceptedTerms) {
      return; // Don't proceed if terms exist and not accepted
    }
    if (hasStarted) {
      onContinue(challenge.id);
    } else {
      onStart(challenge.id);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-sm w-[85%] sm:w-[90%] max-h-[85vh] rounded-lg p-4 sm:p-6 overflow-hidden flex flex-col ${isDark ? 'bg-black' : 'bg-white'}`}>
        <DialogHeader className="text-center mb-3 sm:mb-4">
          <DialogTitle className={`text-xl sm:text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {challenge.name}
          </DialogTitle>
          {challenge.description && (
            <DialogDescription className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {challenge.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] sm:max-h-[60vh] pr-2 flex-1 overflow-y-auto">
          <div className="space-y-3 sm:space-y-4">
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              {challenge.tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className={`text-xs px-2 py-0.5 ${isDark ? 'border-gray-600 text-gray-300 bg-gray-800/50' : 'border-gray-300 text-gray-700 bg-gray-100'}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Challenge Stats */}
            <div className={`p-3 sm:p-4 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                    <HelpCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Questions</p>
                    <p className={`text-base sm:text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {challenge.completedQuestions || 0}/{challenge.totalQuestions}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
                    <Trophy className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>XP Reward</p>
                    <p className={`text-base sm:text-lg font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {challenge.xpReward} XP
                    </p>
                  </div>
                </div>
              </div>
              {hasStarted && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Progress</span>
                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {progressPercentage}%
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-2 rounded-full transition-all ${isDark ? 'bg-blue-500' : 'bg-blue-600'
                        }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* External Link */}
            {challenge.link && (
              <div className="mb-3 sm:mb-4">
                <a
                  href={challenge.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm font-medium ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                    }`}
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">Open Challenge Link</span>
                </a>
              </div>
            )}

            {challenge.rules && <Separator className="my-3 sm:my-4" />}

            {/* Rules & Regulations */}
            {challenge.rules && (
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
                  <FileText className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  <h3 className={`text-sm sm:text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Rules & Regulations
                  </h3>
                </div>
                <div className={`p-2.5 sm:p-3 rounded-lg min-h-[50px] sm:min-h-[60px] ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs sm:text-sm whitespace-pre-line break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {challenge.rules}
                  </p>
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            {challenge.termsAndConditions && (
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
                  <Scale className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h3 className={`text-sm sm:text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Terms & Conditions
                  </h3>
                </div>
                <div className={`p-2.5 sm:p-3 rounded-lg min-h-[50px] sm:min-h-[60px] ${isDark ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs sm:text-sm whitespace-pre-line break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {challenge.termsAndConditions}
                  </p>
                </div>

                {/* Terms Acceptance Checkbox */}
                <div className="mt-3 sm:mt-4 flex items-start space-x-2 sm:space-x-3">
                  <input
                    type="checkbox"
                    id="acceptTerms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className={`mt-0.5 w-4 h-4 cursor-pointer rounded flex-shrink-0 ${isDark ? 'accent-blue-500' : 'accent-blue-600'}`}
                  />
                  <label
                    htmlFor="acceptTerms"
                    className={`text-xs sm:text-sm cursor-pointer leading-relaxed break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    I have read and agree to the terms and conditions
                  </label>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className={`flex items-center gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t flex-shrink-0 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <Button
            variant="outline"
            onClick={onClose}
            size="sm"
            className={`flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 h-auto ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800/50' : 'border-gray-300'}`}
          >
            Close
          </Button>
          {challenge.link && (
            <Button
              variant="outline"
              onClick={() => window.open(challenge.link, '_blank', 'noopener,noreferrer')}
              size="sm"
              className={`flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 h-auto ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800/50' : 'border-gray-300'}`}
            >
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Open Link</span>
              <span className="sm:hidden">Link</span>
            </Button>
          )}
          <Button
            onClick={handleStartClick}
            disabled={!!challenge.termsAndConditions && !acceptedTerms}
            size="sm"
            className={`flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 h-auto ${isDark ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {hasStarted ? (
              <>
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Continue</span>
                <span className="sm:hidden">Cont.</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Start Now</span>
                <span className="sm:hidden">Start</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

