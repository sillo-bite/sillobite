import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import ChallengeDetailsModal from "@/components/challenges/ChallengeDetailsModal";
import { 
  Flame, 
  Code, 
  ArrowLeft, 
  Trophy, 
  HelpCircle,
  CheckCircle2,
  Loader2
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



export default function CodingChallengesPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [selectedChallenge, setSelectedChallenge] = useState<CodingChallenge | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch challenges from API
  const { data: codingChallenges = [], isLoading, error } = useQuery<CodingChallenge[]>({
    queryKey: ['/api/challenges'],
    queryFn: async () => {
      try {
        const response = await apiRequest('/api/challenges');
        console.log('Challenges API response:', response);
        // Ensure response is an array
        if (!Array.isArray(response)) {
          console.error('API response is not an array:', response);
          return [];
        }
        return response;
      } catch (err) {
        console.error('Error fetching challenges:', err);
        throw err;
      }
    }
  });

  // Debug logging
  console.log('CodingChallengesPage render:', { isLoading, error, challengesCount: codingChallenges.length });

  const handleBack = () => {
    window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
  };

  const handleCardClick = (challenge: CodingChallenge) => {
    setSelectedChallenge(challenge);
    setIsModalOpen(true);
  };

  const handleStartChallenge = (challengeId: string) => {
    // TODO: Implement challenge start logic - navigate to challenge questions
    console.log("Starting challenge:", challengeId);
    setIsModalOpen(false);
    // Here you would navigate to the challenge questions page
    // For now, just close the modal
  };

  const handleContinueChallenge = (challengeId: string) => {
    // TODO: Implement continue challenge logic - navigate to challenge questions
    console.log("Continuing challenge:", challengeId);
    setIsModalOpen(false);
    // Here you would navigate to the challenge questions page
    // For now, just close the modal
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedChallenge(null);
  };

  // Ensure component always renders
  if (!resolvedTheme) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Loading theme...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Flame className="w-6 h-6 text-white" />
            <h1 className="text-xl font-bold text-white">Coding Challenges</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-4">
        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`rounded-xl shadow-lg border-0 ${
            isDark ? 'bg-black hover:bg-gray-950' : 'bg-white hover:bg-gray-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Flame className={`w-5 h-5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Current Streak</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>7</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`rounded-xl shadow-lg border-0 ${
            isDark ? 'bg-black hover:bg-gray-950' : 'bg-white hover:bg-gray-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Trophy className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                <div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total XP</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>1,250</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Challenges List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
              Available Challenges
            </h2>
            <Badge variant="outline" className={isDark ? 'border-gray-600 text-gray-300 bg-gray-800/50' : 'border-gray-300 text-gray-700'}>
              {codingChallenges.length} Challenges
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <span className={`ml-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading challenges...</span>
            </div>
          ) : error ? (
            <Card className={`rounded-xl shadow-lg border-0 ${
              isDark ? 'bg-black hover:bg-gray-950' : 'bg-white hover:bg-gray-50'
            }`}>
              <CardContent className="py-12 text-center">
                <Code className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  Failed to load challenges. Please try again later.
                </p>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </CardContent>
            </Card>
          ) : codingChallenges.length === 0 ? (
            <Card className={`rounded-xl shadow-lg border-0 ${
              isDark ? 'bg-black hover:bg-gray-950' : 'bg-white hover:bg-gray-50'
            }`}>
              <CardContent className="py-12 text-center">
                <Code className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                  No challenges available at the moment. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            codingChallenges.map((challenge) => {
            const progressPercentage = challenge.totalQuestions > 0 
              ? Math.round((challenge.completedQuestions || 0) / challenge.totalQuestions * 100) 
              : 0;
            
            return (
              <Card 
                key={challenge.id}
                className={`cursor-pointer transition-all duration-300 rounded-xl shadow-lg border-0 ${
                  isDark 
                    ? 'bg-black hover:bg-gray-950 hover:shadow-xl' 
                    : 'bg-white hover:bg-gray-50 hover:shadow-xl'
                }`}
                onClick={() => handleCardClick(challenge)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className={`text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {challenge.name}
                      </CardTitle>
                      <CardDescription className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {challenge.description}
                      </CardDescription>
                    </div>
                    {challenge.completed && (
                      <CheckCircle2 className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="currentColor" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {challenge.tags.map((tag, index) => (
                      <Badge 
                        key={index}
                        variant="outline"
                        className={isDark ? 'border-gray-600 text-gray-300 bg-gray-800/50' : 'border-gray-300 text-gray-700'}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  {/* Question Information */}
                  <div className={`mb-4 p-3 rounded-lg ${
                    isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <HelpCircle className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          Questions
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {challenge.completedQuestions || 0} / {challenge.totalQuestions} completed
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 mb-2 ${
                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          isDark ? 'bg-blue-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                        {challenge.questionCount} questions available
                      </span>
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                        {progressPercentage}% complete
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Trophy className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {challenge.xpReward} XP
                      </span>
                    </div>
                    <Button 
                      size="sm"
                      className={isDark ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(challenge);
                      }}
                    >
                      {challenge.completedQuestions && challenge.completedQuestions > 0 ? 'Continue' : 'View Details'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
          )}
        </div>

        {/* Bottom spacing */}
        <div className="pb-20"></div>
      </div>

      {/* Challenge Details Modal */}
      <ChallengeDetailsModal
        challenge={selectedChallenge}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onStart={handleStartChallenge}
        onContinue={handleContinueChallenge}
      />
    </div>
  );
}

